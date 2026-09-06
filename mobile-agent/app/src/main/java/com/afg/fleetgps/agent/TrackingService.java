package com.afg.fleetgps.agent;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.util.Locale;

public class TrackingService extends Service {
    private static final String TAG = "FleetTrackingService";
    private static final String CHANNEL_ID = "FleetTrackingServiceChannel";
    private static final int NOTIFICATION_ID = 1001;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private LocationManager nativeLocationManager;
    private LocationListener nativeLocationListener;
    private long lastTelemetrySentTime = 0;

    public static Location lastKnownLocation = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        LogManager.info("SERVICE", "سرویس ردیابی زنده در پس‌زمینه ایجاد شد.");

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                for (Location location : locationResult.getLocations()) {
                    if (location != null) {
                        processNewLocation(location, "Google Play Fused");
                    }
                }
            }
        };

        startForeground(NOTIFICATION_ID, buildNotification());
        requestImmediateLocation();
        startLocationUpdates();
        setupNativeFallbackLocation();
    }

    private synchronized void processNewLocation(Location location, String source) {
        long now = System.currentTimeMillis();
        // Throttle to maximum once every 5 seconds to prevent spam
        if (now - lastTelemetrySentTime < 5000) {
            return;
        }
        lastTelemetrySentTime = now;
        lastKnownLocation = location;

        float accuracy = location.hasAccuracy() ? location.getAccuracy() : -1;
        LogManager.info("GPS", String.format(Locale.US,
                "موقعیت دریافت شد (%s): %.5f, %.5f | دقت: %.1fm | سرعت: %.1f km/h",
                source, location.getLatitude(), location.getLongitude(), accuracy, location.getSpeed() * 3.6f));

        new Thread(() -> {
            ApiClient.sendTelemetry(
                    getApplicationContext(),
                    location.getLatitude(),
                    location.getLongitude(),
                    location.getSpeed(),
                    location.getBearing(),
                    location.getAltitude()
            );
        }).start();
    }

    @SuppressLint("MissingPermission")
    private void requestImmediateLocation() {
        try {
            fusedLocationClient.getLastLocation().addOnSuccessListener(loc -> {
                if (loc != null) {
                    LogManager.success("GPS", String.format(Locale.US,
                            "آخرین موقعیت ثبت‌شده در گوشی: %.5f, %.5f", loc.getLatitude(), loc.getLongitude()));
                    processNewLocation(loc, "LastKnownCache");
                } else {
                    LogManager.info("GPS", "در انتظار دریافت قفل ماهواره‌ای تازه...");
                }
            }).addOnFailureListener(e -> {
                LogManager.warning("GPS", "عدم امکان دریافت موقعیت اولیه: " + e.getMessage());
            });
        } catch (Exception e) {
            LogManager.warning("GPS", "خطا در استعلام اولیه موقعیت: " + e.getMessage());
        }
    }

    @SuppressLint("MissingPermission")
    private void startLocationUpdates() {
        try {
            LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 15000)
                    .setMinUpdateIntervalMillis(8000)
                    .setMinUpdateDistanceMeters(0) // Stationary devices will update on timer
                    .build();

            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
            Log.d(TAG, "Location updates requested successfully");
            LogManager.info("GPS", "درخواست موقعیت دوره‌ای فعال شد (فاصله زمانی: ۱۵ ثانیه).");
        } catch (Exception e) {
            Log.e(TAG, "Error requesting location updates: " + e.getMessage());
            LogManager.error("GPS", "خطا در ثبت درخواست موقعیت Fused: " + e.getMessage());
        }
    }

    @SuppressLint("MissingPermission")
    private void setupNativeFallbackLocation() {
        try {
            nativeLocationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (nativeLocationManager == null) return;

            nativeLocationListener = new LocationListener() {
                @Override
                public void onLocationChanged(Location location) {
                    if (location != null) {
                        processNewLocation(location, "Android Native");
                    }
                }

                @Override
                public void onStatusChanged(String provider, int status, Bundle extras) {}

                @Override
                public void onProviderEnabled(String provider) {
                    LogManager.info("GPS", "پرووایدر " + provider + " روشن گردید.");
                }

                @Override
                public void onProviderDisabled(String provider) {
                    LogManager.warning("GPS", "پرووایدر " + provider + " خاموش شد.");
                }
            };

            // Register GPS Provider
            if (nativeLocationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                nativeLocationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        15000,
                        0,
                        nativeLocationListener,
                        Looper.getMainLooper()
                );
            }

            // Register Network Provider (useful indoors)
            if (nativeLocationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                nativeLocationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        15000,
                        0,
                        nativeLocationListener,
                        Looper.getMainLooper()
                );
            }
        } catch (Exception e) {
            LogManager.warning("GPS", "خطای راه‌اندازی پرووایدر بومی اندروید: " + e.getMessage());
        }
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.service_notification_title))
                .setContentText(getString(R.string.service_notification_text))
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Fleet Tracking Service Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        LogManager.info("SERVICE", "سرویس ردیابی فراخوانی شد (START_STICKY).");
        return START_STICKY; // Auto restart if killed by OS
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        LogManager.warning("SERVICE", "سرویس ردیابی پس‌زمینه متوقف گردید.");
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        if (nativeLocationManager != null && nativeLocationListener != null) {
            try {
                nativeLocationManager.removeUpdates(nativeLocationListener);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

