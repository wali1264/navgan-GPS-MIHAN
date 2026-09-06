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
import android.os.Handler;
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
    private static long lastSuccessfulInternetTime = System.currentTimeMillis();
    private Handler offlineMonitorHandler;
    private Runnable offlineMonitorRunnable;

    public static class HarvestedLocation {
        public final Location location;
        public final String source;
        public final long timestamp;

        public HarvestedLocation(Location location, String source, long timestamp) {
            this.location = location;
            this.source = source;
            this.timestamp = timestamp;
        }
    }

    public static volatile HarvestedLocation lastHarvestedLocation = null;
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
                        String source = "GPS ماهواره‌ای";
                        if (location.getProvider() != null && location.getProvider().equalsIgnoreCase(LocationManager.NETWORK_PROVIDER)) {
                            source = "دکل مخابراتی/Cell";
                        }
                        processNewLocation(location, source);
                    }
                }
            }
        };

        startForeground(NOTIFICATION_ID, buildNotification());
        requestImmediateLocation();
        startLocationUpdates();
        setupNativeFallbackLocation();
        startOfflineInternetMonitoring();
    }

    private synchronized void processNewLocation(Location location, String source) {
        long now = System.currentTimeMillis();
        // Always store freshest coordinates into Harvested Memory Cache
        lastHarvestedLocation = new HarvestedLocation(location, source, now);
        lastKnownLocation = location;

        // Check user-configured online interval
        int intervalSec = ApiClient.getOnlineTrackingIntervalSeconds(this);
        long minIntervalMillis = Math.max(5000L, intervalSec * 1000L);
        if (now - lastTelemetrySentTime < minIntervalMillis) {
            // Keep harvested in RAM, but wait until interval passes before sending to Supabase
            return;
        }
        lastTelemetrySentTime = now;

        float accuracy = location.hasAccuracy() ? location.getAccuracy() : -1;
        LogManager.info("GPS", String.format(Locale.US,
                "موقعیت استخراج شد (%s): %.5f, %.5f | دقت: %.1fm | سرعت: %.1f km/h",
                source, location.getLatitude(), location.getLongitude(), accuracy, location.getSpeed() * 3.6f));

        new Thread(() -> {
            ApiClient.TelemetryResult result = ApiClient.sendTelemetryDetailed(
                    getApplicationContext(),
                    location.getLatitude(),
                    location.getLongitude(),
                    location.getSpeed(),
                    location.getBearing(),
                    location.getAltitude()
            );
            if (result != null && result.success) {
                lastSuccessfulInternetTime = System.currentTimeMillis();
            }
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
                    LogManager.info("GPS", "در انتظار دریافت قفل موقعیت مکانی (ماهواره یا دکل آنتن)...");
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
            // High Accuracy GPS request
            LocationRequest locationRequestHigh = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 15000)
                    .setMinUpdateIntervalMillis(8000)
                    .setMinUpdateDistanceMeters(0)
                    .build();

            fusedLocationClient.requestLocationUpdates(locationRequestHigh, locationCallback, Looper.getMainLooper());

            // Balanced Power request (uses Cell-Towers & Wi-Fi networks even if GPS satellite toggle is off)
            LocationRequest locationRequestBalanced = new LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 20000)
                    .setMinUpdateIntervalMillis(10000)
                    .setMinUpdateDistanceMeters(0)
                    .build();

            fusedLocationClient.requestLocationUpdates(locationRequestBalanced, locationCallback, Looper.getMainLooper());

            Log.d(TAG, "Location updates (High + Balanced Cell) requested successfully");
            LogManager.info("GPS", "موتور موقعیت‌یابی ترکیبی (ماهواره GPS + دکل‌های مخابراتی) فعال گردید.");
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
                        String prov = location.getProvider();
                        String tag = "GPS ماهواره‌ای";
                        if (LocationManager.NETWORK_PROVIDER.equalsIgnoreCase(prov)) {
                            tag = "دکل آنتن مخابراتی/وای‌فای";
                        }
                        processNewLocation(location, tag);
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
                    LogManager.warning("GPS", "پرووایدر " + provider + " توسط کاربر خاموش شد (سوئیچ خودکار به سایر منابع).");
                }
            };

            // Register GPS Provider if available
            try {
                if (nativeLocationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    nativeLocationManager.requestLocationUpdates(
                            LocationManager.GPS_PROVIDER,
                            15000,
                            0,
                            nativeLocationListener,
                            Looper.getMainLooper()
                    );
                }
            } catch (Exception ignored) {}

            // Register Cell Network Provider (works indoors and even when GPS satellite is turned off)
            try {
                if (nativeLocationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    nativeLocationManager.requestLocationUpdates(
                            LocationManager.NETWORK_PROVIDER,
                            15000,
                            0,
                            nativeLocationListener,
                            Looper.getMainLooper()
                    );
                    LogManager.info("GPS", "پرووایدر بومی دکل‌های مخابراتی (Network Provider) آماده به کار است.");
                }
            } catch (Exception ignored) {}

            // Passive provider
            try {
                nativeLocationManager.requestLocationUpdates(
                        LocationManager.PASSIVE_PROVIDER,
                        15000,
                        0,
                        nativeLocationListener,
                        Looper.getMainLooper()
                );
            } catch (Exception ignored) {}

        } catch (Exception e) {
            LogManager.warning("GPS", "خطای راه‌اندازی پرووایدر بومی اندروید: " + e.getMessage());
        }
    }

    private void startOfflineInternetMonitoring() {
        offlineMonitorHandler = new Handler(Looper.getMainLooper());
        offlineMonitorRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    checkAndTriggerOfflineSms();
                } catch (Exception e) {
                    Log.e(TAG, "Offline monitoring check error: " + e.getMessage());
                }
                // Check every 5 minutes
                if (offlineMonitorHandler != null) {
                    offlineMonitorHandler.postDelayed(this, 5 * 60 * 1000L);
                }
            }
        };
        offlineMonitorHandler.postDelayed(offlineMonitorRunnable, 2 * 60 * 1000L);
    }

    private void checkAndTriggerOfflineSms() {
        if (!ApiClient.isOfflineSmsEnabled(this)) return;

        int graceHours = ApiClient.getOfflineGraceHours(this);
        long graceThresholdMillis = (long) graceHours * 3600 * 1000L;
        long now = System.currentTimeMillis();
        long offlineDuration = now - lastSuccessfulInternetTime;

        if (offlineDuration >= graceThresholdMillis) {
            int freqMinutes = ApiClient.getOfflineSmsFrequencyMinutes(this);
            long freqMillis = (long) freqMinutes * 60 * 1000L;
            long lastSent = ApiClient.getLastOfflineSmsSentTime(this);

            if (now - lastSent >= freqMillis) {
                String emergencyPhone = ApiClient.getEmergencyPhone(this);
                if (emergencyPhone != null && !emergencyPhone.trim().isEmpty()) {
                    sendOfflineEmergencySms(emergencyPhone, graceHours, offlineDuration);
                    ApiClient.setLastOfflineSmsSentTime(this, now);
                }
            }
        }
    }

    private void sendOfflineEmergencySms(String phone, int graceHours, long offlineDuration) {
        HarvestedLocation harvested = lastHarvestedLocation;
        Location loc = harvested != null ? harvested.location : lastKnownLocation;
        String age = harvested != null ? ApiClient.formatLocationAge(harvested.timestamp) : "زنده";
        String source = harvested != null ? harvested.source : (loc != null && loc.getProvider() != null ? loc.getProvider() : "دکل مخابراتی/Cell");
        int battery = ApiClient.getBatteryLevel(this);

        long offlineHours = Math.max(1, offlineDuration / (3600 * 1000L));

        StringBuilder sb = new StringBuilder();
        sb.append("⚠️ هشدار قطعی اینترنت ردیاب (Fleet Guard):\n");
        sb.append("اینترنت گوشی به مدت بیش از ").append(offlineHours).append(" ساعت قطع بوده است.\n");
        if (loc != null) {
            sb.append("📍 آخرین موقعیت مکانی:\n");
            sb.append("https://maps.google.com/?q=").append(loc.getLatitude()).append(",").append(loc.getLongitude()).append("\n");
            sb.append("زمان ثبت: ").append(age).append("\n");
            sb.append("منبع داده: ").append(source).append("\n");
            sb.append("دقت: ").append((int) loc.getAccuracy()).append("m | ");
            sb.append("سرعت: ").append((int) (loc.getSpeed() * 3.6)).append(" km/h\n");
        } else {
            sb.append("📍 مختصات مکانی هنوز دریافت نشده است.\n");
        }
        sb.append("شارژ باتری: ").append(battery).append("%");

        try {
            android.telephony.SmsManager sms = android.telephony.SmsManager.getDefault();
            sms.sendTextMessage(phone, null, sb.toString(), null, null);
            LogManager.warning("OFFLINE_SMS", "پیامک اضطراری قطعی اینترنت (" + offlineHours + " ساعت) با موفقیت به شماره " + phone + " ارسال شد.");
        } catch (Exception e) {
            LogManager.error("OFFLINE_SMS", "خطا در ارسال پیامک اضطراری قطعی اینترنت: " + e.getMessage());
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

