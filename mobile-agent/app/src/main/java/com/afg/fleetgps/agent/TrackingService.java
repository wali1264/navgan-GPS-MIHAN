package com.afg.fleetgps.agent;

import android.annotation.SuppressLint;
import android.app.AlarmManager;
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
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class TrackingService extends Service {
    private static final String TAG = "FleetTrackingService";
    private static final String CHANNEL_ID = "FleetTrackingServiceChannel";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_RELOAD_INTERVALS = "com.afg.fleetgps.RELOAD_INTERVALS";
    public static final String ACTION_ALARM_HEARTBEAT = "com.afg.fleetgps.ALARM_HEARTBEAT";

    private PowerManager.WakeLock wakeLock;
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private LocationManager nativeLocationManager;
    private LocationListener nativeLocationListener;
    private static long lastSuccessfulInternetTime = System.currentTimeMillis();
    private Handler offlineMonitorHandler;
    private Runnable offlineMonitorRunnable;
    private Handler telemetryHandler;
    private Runnable telemetryRunnable;
    private BroadcastReceiver screenReceiver;
    private long lastScreenOnCaptureTime = 0;

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
                        onLocationHarvested(location, "fused");
                    }
                }
            }
        };

        startForeground(NOTIFICATION_ID, buildNotification());

        // Acquire Partial WakeLock to prevent CPU Deep Sleep when screen is off in pocket
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FleetGPS:KeepAliveWakeLock");
                if (wakeLock != null) {
                    wakeLock.setReferenceCounted(false);
                    wakeLock.acquire();
                    LogManager.info("POWER", "قفل پردازنده (WakeLock) برای کار در جیب و صفحه خاموش فعال شد.");
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error acquiring WakeLock: " + e.getMessage());
        }

        requestImmediateLocation();
        startLocationUpdates();
        setupNativeFallbackLocation();
        startOfflineInternetMonitoring();
        startOnlineTelemetryLoop();
        scheduleNextAlarmHeartbeat();
        setupScreenStateListener();
    }

    private void setupScreenStateListener() {
        try {
            android.content.IntentFilter filter = new android.content.IntentFilter();
            filter.addAction(Intent.ACTION_SCREEN_ON);
            filter.addAction(Intent.ACTION_USER_PRESENT);
            screenReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    // Only trigger if device is in verified Theft Mode
                    if (ApiClient.isTheftMode(context)) {
                        long now = System.currentTimeMillis();
                        if (now - lastScreenOnCaptureTime > 60000L) { // Max once per minute
                            lastScreenOnCaptureTime = now;
                            Location loc = lastKnownLocation;
                            double lat = loc != null ? loc.getLatitude() : 0.0;
                            double lng = loc != null ? loc.getLongitude() : 0.0;
                            LogManager.warning("SECURITY", "روشن شدن صفحه در وضعیت سرقت شناسایی شد! ثبت مخفی تصویر چهره متجاوز...");
                            HiddenCameraManager.captureIntruderPhoto(context, "screen_on_theft_mode", lat, lng);
                        }
                    }
                }
            };
            registerReceiver(screenReceiver, filter);
            Log.d(TAG, "Theft Mode screen state receiver registered");
        } catch (Exception e) {
            Log.e(TAG, "Error registering screen state receiver: " + e.getMessage());
        }
    }

    public static String determineSourceTag(Context context, Location location, String initialHint) {
        if (location == null) return "نامشخص";
        String prov = location.getProvider();
        if ("cell_tower".equalsIgnoreCase(prov) || "cell".equalsIgnoreCase(initialHint) || (initialHint != null && initialHint.contains("دکل"))) {
            return (initialHint != null && initialHint.contains("دکل")) ? initialHint : "دکل مخابراتی (Cell Tower/BTS)";
        }
        if (LocationManager.PASSIVE_PROVIDER.equalsIgnoreCase(prov) || "passive".equalsIgnoreCase(initialHint)) {
            return "شکار هوایی (سایر برنامه‌ها)";
        }
        if (LocationManager.GPS_PROVIDER.equalsIgnoreCase(prov)) {
            return "ماهواره GPS";
        }

        boolean wifiEnabled = false;
        try {
            android.net.wifi.WifiManager wm = (android.net.wifi.WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                boolean scanAlways = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) && wm.isScanAlwaysAvailable();
                if (wm.isWifiEnabled() || scanAlways) {
                    wifiEnabled = true;
                }
            }
        } catch (Exception ignored) {}

        boolean gpsEnabled = false;
        try {
            LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) {
                gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
            }
        } catch (Exception ignored) {}

        float acc = location.hasAccuracy() ? location.getAccuracy() : 100f;

        if (gpsEnabled && acc <= 18.0f) {
            return "ماهواره GPS";
        } else if (wifiEnabled && acc <= 55.0f) {
            return "وای‌فای / مودم‌های اطراف (Wi-Fi)";
        } else if (LocationManager.NETWORK_PROVIDER.equalsIgnoreCase(prov) || "network".equalsIgnoreCase(initialHint)) {
            return (acc <= 60.0f && wifiEnabled) ? "وای‌فای / مودم‌های اطراف (Wi-Fi)" : "دکل مخابراتی (Cell Tower/BTS)";
        } else if (acc <= 55.0f) {
            return "وای‌فای / مودم‌های اطراف (Wi-Fi)";
        } else {
            return "دکل مخابراتی (Cell Tower/BTS)";
        }
    }

    private synchronized void onLocationHarvested(Location location, String hint) {
        if (location == null) return;
        long now = System.currentTimeMillis();
        String sourceTag = determineSourceTag(this, location, hint);

        // Put freshest prepared dish on the table
        lastHarvestedLocation = new HarvestedLocation(location, sourceTag, now);
        lastKnownLocation = location;

        float accuracy = location.hasAccuracy() ? location.getAccuracy() : -1;
        LogManager.info("LOCATION", String.format(Locale.US,
                "📦 لقمه آماده موتور (%s): %.5f, %.5f | دقت: %.1fm | سرعت: %.1f km/h",
                sourceTag, location.getLatitude(), location.getLongitude(), accuracy, location.getSpeed() * 3.6f));
    }

    @SuppressLint("MissingPermission")
    private void requestImmediateLocation() {
        try {
            fusedLocationClient.getLastLocation().addOnSuccessListener(loc -> {
                if (loc != null) {
                    onLocationHarvested(loc, "LastKnownCache");
                    LogManager.success("LOCATION", String.format(Locale.US,
                            "آخرین موقعیت ثبت‌شده در گوشی بارگذاری گردید: %.5f, %.5f", loc.getLatitude(), loc.getLongitude()));
                } else {
                    LogManager.info("LOCATION", "در انتظار استخراج اولیه موقعیت از موتور (ماهواره، دکل، وای‌فای)...");
                }
            }).addOnFailureListener(e -> {
                LogManager.warning("LOCATION", "عدم امکان دریافت موقعیت اولیه: " + e.getMessage());
            });
        } catch (Exception e) {
            LogManager.warning("LOCATION", "خطا در استعلام اولیه موقعیت: " + e.getMessage());
        }
    }

    @SuppressLint("MissingPermission")
    private void startLocationUpdates() {
        try {
            int harvestSec = ApiClient.getHarvestIntervalSeconds(this);
            long harvestMillis = Math.max(5000L, harvestSec * 1000L);

            // High Accuracy GPS request
            LocationRequest locationRequestHigh = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, harvestMillis)
                    .setMinUpdateIntervalMillis(Math.max(3000L, harvestMillis / 2))
                    .setMinUpdateDistanceMeters(0)
                    .build();

            fusedLocationClient.requestLocationUpdates(locationRequestHigh, locationCallback, Looper.getMainLooper());

            // Balanced Power request (uses Cell-Towers & Wi-Fi routers even if GPS satellite toggle is off)
            LocationRequest locationRequestBalanced = new LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, harvestMillis)
                    .setMinUpdateIntervalMillis(Math.max(3000L, harvestMillis / 2))
                    .setMinUpdateDistanceMeters(0)
                    .build();

            fusedLocationClient.requestLocationUpdates(locationRequestBalanced, locationCallback, Looper.getMainLooper());

            // Trigger background WiFi scan so nearby routers are cached even when WiFi toggle is off
            triggerBackgroundWifiScan();

            Log.d(TAG, "Location updates requested with harvest interval: " + harvestSec + "s");
            LogManager.info("LOCATION", "موتور استخراج موقعیت (کارگر آماده‌ساز) با دوره " + harvestSec + " ثانیه فعال شد.");
        } catch (Exception e) {
            Log.e(TAG, "Error requesting location updates: " + e.getMessage());
            LogManager.error("LOCATION", "خطا در ثبت درخواست موقعیت Fused: " + e.getMessage());
        }
    }

    private void triggerBackgroundWifiScan() {
        try {
            android.net.wifi.WifiManager wm = (android.net.wifi.WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                boolean scanAlways = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) && wm.isScanAlwaysAvailable();
                if (wm.isWifiEnabled() || scanAlways) {
                    wm.startScan();
                }
            }
        } catch (Exception ignored) {}
    }

    @SuppressLint("MissingPermission")
    private void setupNativeFallbackLocation() {
        try {
            nativeLocationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (nativeLocationManager == null) return;

            int harvestSec = ApiClient.getHarvestIntervalSeconds(this);
            long harvestMillis = Math.max(5000L, harvestSec * 1000L);

            nativeLocationListener = new LocationListener() {
                @Override
                public void onLocationChanged(Location location) {
                    if (location != null) {
                        String prov = location.getProvider();
                        onLocationHarvested(location, prov);
                    }
                }

                @Override
                public void onStatusChanged(String provider, int status, Bundle extras) {}

                @Override
                public void onProviderEnabled(String provider) {
                    LogManager.info("LOCATION", "منبع گیرنده " + provider + " روشن گردید.");
                }

                @Override
                public void onProviderDisabled(String provider) {
                    LogManager.warning("LOCATION", "منبع " + provider + " خاموش شد (پوشش خودکار توسط سایر منابع موتور).");
                }
            };

            // Register GPS Provider if available
            try {
                if (nativeLocationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    nativeLocationManager.requestLocationUpdates(
                            LocationManager.GPS_PROVIDER,
                            harvestMillis,
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
                            harvestMillis,
                            0,
                            nativeLocationListener,
                            Looper.getMainLooper()
                    );
                    LogManager.info("LOCATION", "گیرنده بومی دکل‌های مخابراتی (Network Provider) متصل است.");
                }
            } catch (Exception ignored) {}

            // Passive provider (sniffing location from Google Maps, WhatsApp, Snapp, etc.)
            try {
                nativeLocationManager.requestLocationUpdates(
                        LocationManager.PASSIVE_PROVIDER,
                        harvestMillis,
                        0,
                        nativeLocationListener,
                        Looper.getMainLooper()
                );
                LogManager.info("LOCATION", "شکارچی موقعیت پس‌زمینه (Passive Provider) برای شکار لوکیشن سایر برنامه‌ها فعال است.");
            } catch (Exception ignored) {}

        } catch (Exception e) {
            LogManager.warning("LOCATION", "خطای راه‌اندازی پرووایدر بومی اندروید: " + e.getMessage());
        }
    }

    private void startOnlineTelemetryLoop() {
        if (telemetryHandler != null && telemetryRunnable != null) {
            telemetryHandler.removeCallbacks(telemetryRunnable);
        }

        telemetryHandler = new Handler(Looper.getMainLooper());
        telemetryRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    sendPreparedMealToCloud();
                } catch (Exception e) {
                    Log.e(TAG, "Online telemetry loop error: " + e.getMessage());
                }

                int onlineIntervalSec = ApiClient.getOnlineTrackingIntervalSeconds(TrackingService.this);
                long nextDelay = Math.max(5000L, onlineIntervalSec * 1000L);
                if (telemetryHandler != null) {
                    telemetryHandler.postDelayed(this, nextDelay);
                }
            }
        };

        int initialDelay = Math.min(5000, ApiClient.getOnlineTrackingIntervalSeconds(this) * 1000);
        telemetryHandler.postDelayed(telemetryRunnable, initialDelay);
    }

    @SuppressLint("MissingPermission")
    private void sendPreparedMealToCloud() {
        HarvestedLocation harvested = lastHarvestedLocation;

        // If table has a ready meal, serve it immediately!
        if (harvested != null && harvested.location != null) {
            Location loc = harvested.location;
            String source = harvested.source;
            String age = ApiClient.formatLocationAge(harvested.timestamp);

            LogManager.info("SUPABASE", String.format(Locale.US,
                    "📤 ارسال به سرور از میز آماده موتور (%s - زمان: %s): %.5f, %.5f | دقت: %.1fm",
                    source, age, loc.getLatitude(), loc.getLongitude(), loc.getAccuracy()));

            new Thread(() -> {
                ApiClient.TelemetryResult result = ApiClient.sendTelemetryDetailed(
                        getApplicationContext(),
                        loc.getLatitude(),
                        loc.getLongitude(),
                        loc.getSpeed(),
                        loc.getBearing(),
                        loc.getAltitude()
                );
                if (result != null && result.success) {
                    lastSuccessfulInternetTime = System.currentTimeMillis();
                    SecurityPhotoQueue.flushPendingPhotos(getApplicationContext());
                }
            }).start();
            return;
        }

        // Emergency fallback: If table is empty, query kitchen directly
        LogManager.warning("LOCATION", "میز آماده موتور خالی است؛ استعلام اضطراری مستقیم از حافظه سیستم...");
        try {
            if (fusedLocationClient != null) {
                fusedLocationClient.getLastLocation().addOnSuccessListener(loc -> {
                    if (loc != null) {
                        onLocationHarvested(loc, "KitchenFallback");
                        sendPreparedMealToCloud();
                    } else {
                        tryCellTowerHarvest();
                    }
                }).addOnFailureListener(e -> tryCellTowerHarvest());
            } else {
                tryCellTowerHarvest();
            }
        } catch (Exception e) {
            tryCellTowerHarvest();
        }
    }

    private void tryCellTowerHarvest() {
        new Thread(() -> {
            try {
                ApiClient.CellInfoDetail cell = ApiClient.getActiveCellInfo(getApplicationContext());
                if (cell != null && cell.isValid()) {
                    LogManager.info("CELL", "شناسه‌های دکل فعال متصل: " + cell.getDisplaySummary());
                    Location cellLoc = ApiClient.resolveCellLocation(getApplicationContext(), cell);
                    if (cellLoc != null) {
                        String tag = "دکل مخابراتی (" + cell.getDisplaySummary() + ")";
                        onLocationHarvested(cellLoc, tag);
                        sendPreparedMealToCloud();
                        return;
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Cell tower harvest attempt error: " + e.getMessage());
            }
            sendKeepAliveStatusOnly();
        }).start();
    }

    private void sendKeepAliveStatusOnly() {
        String imei = ApiClient.getDeviceImei(this);
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        String nowIso = sdf.format(new Date());
        ApiClient.updateDeviceStatusAsync(imei, nowIso);

        ApiClient.CellInfoDetail cell = ApiClient.getActiveCellInfo(this);
        String cellText = (cell != null && cell.isValid()) ? " | " + cell.getDisplaySummary() : "";
        LogManager.info("HEARTBEAT", "ارسال ضربان قلب و سیگنال زنده (Keep-Alive) وضعیت آنلاین: " + imei + cellText);
    }

    public void reloadEngineIntervals() {
        LogManager.info("CONFIG", "به‌روزرسانی تنظیمات دوره‌های زمانی موتور استخراج و ارسال به سرور...");
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        if (nativeLocationManager != null && nativeLocationListener != null) {
            try {
                nativeLocationManager.removeUpdates(nativeLocationListener);
            } catch (Exception ignored) {}
        }
        startLocationUpdates();
        setupNativeFallbackLocation();
        startOnlineTelemetryLoop();
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
            SmsCommandReceiver.sendSafeSms(phone, sb.toString());
            LogManager.warning("OFFLINE_SMS", "پیامک اضطراری قطعی اینترنت (" + offlineHours + " ساعت) با موفقیت به شماره " + phone + " ارسال شد.");
        } catch (Exception e) {
            LogManager.error("OFFLINE_SMS", "خطا در ارسال پیامک اضطراری قطعی اینترنت: " + e.getMessage());
        }
    }

    private Notification buildNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        notificationIntent.putExtra("from_notification", true);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.service_notification_title))
                .setContentText(getString(R.string.service_notification_text))
                .setSmallIcon(android.R.drawable.ic_menu_manage)
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
        if (intent != null) {
            if (ACTION_RELOAD_INTERVALS.equals(intent.getAction())) {
                reloadEngineIntervals();
                return START_STICKY;
            } else if (ACTION_ALARM_HEARTBEAT.equals(intent.getAction())) {
                try {
                    sendPreparedMealToCloud();
                } catch (Exception e) {
                    Log.w(TAG, "Alarm heartbeat execution error: " + e.getMessage());
                }
                scheduleNextAlarmHeartbeat();
                return START_STICKY;
            }
        }
        LogManager.info("SERVICE", "سرویس ردیابی فراخوانی شد (START_STICKY).");
        return START_STICKY; // Auto restart if killed by OS
    }

    private void scheduleNextAlarmHeartbeat() {
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            int intervalSec = ApiClient.getOnlineTrackingIntervalSeconds(this);
            long triggerAtMillis = SystemClock.elapsedRealtime() + Math.max(5000L, intervalSec * 1000L);

            Intent intent = new Intent(this, TrackingService.class);
            intent.setAction(ACTION_ALARM_HEARTBEAT);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getService(this, 1001, intent, flags);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pi);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pi);
            } else {
                am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pi);
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to schedule exact alarm heartbeat: " + e.getMessage());
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        LogManager.warning("SERVICE", "سرویس ردیابی پس‌زمینه متوقف گردید.");
        if (screenReceiver != null) {
            try {
                unregisterReceiver(screenReceiver);
            } catch (Exception ignored) {}
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
                Log.i(TAG, "WakeLock safely released on service destroy.");
            } catch (Exception ignored) {}
        }
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                Intent intent = new Intent(this, TrackingService.class);
                intent.setAction(ACTION_ALARM_HEARTBEAT);
                int flags = PendingIntent.FLAG_NO_CREATE;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pi = PendingIntent.getService(this, 1001, intent, flags);
                if (pi != null) am.cancel(pi);
            }
        } catch (Exception ignored) {}
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        if (nativeLocationManager != null && nativeLocationListener != null) {
            try {
                nativeLocationManager.removeUpdates(nativeLocationListener);
            } catch (Exception ignored) {}
        }
        if (telemetryHandler != null && telemetryRunnable != null) {
            telemetryHandler.removeCallbacks(telemetryRunnable);
        }
        if (offlineMonitorHandler != null && offlineMonitorRunnable != null) {
            offlineMonitorHandler.removeCallbacks(offlineMonitorRunnable);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

