package com.afg.fleetgps.agent;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.BatteryManager;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class ApiClient {
    private static final String TAG = "FleetApiClient";
    private static final String PREF_NAME = "FleetAgentPrefs";

    // Direct Supabase REST API Configuration (Option A: 100% reliable, zero-middleman)
    public static final String SUPABASE_REST_BASE = "https://yujovpmltigdtelftvdz.supabase.co";
    public static final String SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1am92cG1sdGlnZHRlbGZ0dmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODE4NzksImV4cCI6MjEwMzY1Nzg3OX0.YAyi-QEJA4QKL4GePA4S5lH9Pi5TqsYCnehUf795kAI";

    public static String getServerUrl(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        String url = prefs.getString("server_url", SUPABASE_REST_BASE);
        if (url == null || url.trim().isEmpty() || url.contains("your-fleet-server.com")) {
            return SUPABASE_REST_BASE;
        }
        return url.trim();
    }

    public static String getDeviceImei(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getString("device_imei", "AFG-000001");
    }

    public static String getEmergencyPhone(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getString("emergency_phone", "");
    }

    public static String getRegisteredIccid(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getString("registered_iccid", "");
    }

    public static boolean isSimAuthorized(Context context, String detectedIccid) {
        if (detectedIccid == null || detectedIccid.trim().isEmpty()) {
            return true;
        }
        String registeredIccids = getRegisteredIccid(context);
        if (registeredIccids == null || registeredIccids.trim().isEmpty()) {
            return true;
        }
        String[] allowedList = registeredIccids.split(",");
        for (String allowed : allowedList) {
            if (allowed != null && !allowed.trim().isEmpty()) {
                if (allowed.trim().equalsIgnoreCase(detectedIccid.trim())) {
                    return true;
                }
            }
        }
        return false;
    }

    public static void saveConfig(Context context, String serverUrl, String deviceImei, String emergencyPhone, String iccid) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit()
                .putString("server_url", serverUrl)
                .putString("device_imei", deviceImei)
                .putString("emergency_phone", emergencyPhone)
                .putString("registered_iccid", iccid)
                .apply();
    }

    public static String getAntiTheftPin(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getString("anti_theft_pin", "1234");
    }

    public static void saveAntiTheftPin(Context context, String pin) {
        if (pin == null || pin.trim().isEmpty()) pin = "1234";
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString("anti_theft_pin", pin.trim()).apply();
    }

    public static boolean isStealthModeEnabled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean("stealth_mode_active", false);
    }

    public static void setStealthMode(Context context, boolean enable) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("stealth_mode_active", enable).apply();

        try {
            android.content.pm.PackageManager pm = context.getPackageManager();
            android.content.ComponentName alias = new android.content.ComponentName(
                    context,
                    "com.afg.fleetgps.agent.LauncherAlias"
            );
            int newState = enable ?
                    android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_DISABLED :
                    android.content.pm.PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
            pm.setComponentEnabledSetting(alias, newState, android.content.pm.PackageManager.DONT_KILL_APP);
            Log.i(TAG, "LauncherAlias stealth state changed to: " + enable);
        } catch (Exception e) {
            Log.e(TAG, "Error setting stealth mode component: " + e.getMessage());
        }
    }

    public static int getOnlineTrackingIntervalSeconds(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getInt("online_tracking_interval_sec", 15);
    }

    public static void setOnlineTrackingIntervalSeconds(Context context, int seconds) {
        if (seconds < 5) seconds = 5;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putInt("online_tracking_interval_sec", seconds).apply();
    }

    public static boolean isOfflineSmsEnabled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean("offline_sms_enabled", false);
    }

    public static void setOfflineSmsEnabled(Context context, boolean enabled) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("offline_sms_enabled", enabled).apply();
    }

    public static int getOfflineGraceHours(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getInt("offline_grace_hours", 3);
    }

    public static void setOfflineGraceHours(Context context, int hours) {
        if (hours < 1) hours = 1;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putInt("offline_grace_hours", hours).apply();
    }

    public static int getOfflineSmsFrequencyMinutes(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getInt("offline_sms_freq_minutes", 60);
    }

    public static void setOfflineSmsFrequencyMinutes(Context context, int minutes) {
        if (minutes < 5) minutes = 5;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putInt("offline_sms_freq_minutes", minutes).apply();
    }

    public static long getLastOfflineSmsSentTime(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getLong("last_offline_sms_sent_time", 0);
    }

    public static void setLastOfflineSmsSentTime(Context context, long time) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putLong("last_offline_sms_sent_time", time).apply();
    }

    public static String formatLocationAge(long timestamp) {
        if (timestamp <= 0) return "نامشخص";
        long diffMs = System.currentTimeMillis() - timestamp;
        if (diffMs < 0) diffMs = 0;
        long diffSec = diffMs / 1000;
        if (diffSec < 120) {
            return "زنده (هم‌اکنون)";
        }
        long diffMin = diffSec / 60;
        if (diffMin < 60) {
            return diffMin + " دقیقه پیش";
        }
        long diffHours = diffMin / 60;
        long remMin = diffMin % 60;
        if (remMin == 0) {
            return diffHours + " ساعت پیش";
        }
        return diffHours + " ساعت و " + remMin + " دقیقه پیش";
    }

    public static int getBatteryLevel(Context context) {
        try {
            BatteryManager bm = (BatteryManager) context.getSystemService(Context.BATTERY_SERVICE);
            if (bm != null) {
                return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            }
        } catch (Exception ignored) {}
        return 100;
    }

    public static class TelemetryResult {
        public final boolean success;
        public final int statusCode;
        public final String responseBody;
        public final String errorMessage;

        public TelemetryResult(boolean success, int statusCode, String responseBody, String errorMessage) {
            this.success = success;
            this.statusCode = statusCode;
            this.responseBody = responseBody;
            this.errorMessage = errorMessage;
        }
    }

    public static boolean sendTelemetry(Context context, double lat, double lng, float speed, float bearing, double altitude) {
        TelemetryResult res = sendTelemetryDetailed(context, lat, lng, speed, bearing, altitude);
        return res.success;
    }

    public static TelemetryResult sendTelemetryDetailed(Context context, double lat, double lng, float speed, float bearing, double altitude) {
        String baseUrl = getServerUrl(context);
        String imei = getDeviceImei(context);
        int speedKm = (int) (speed * 3.6f);
        int battery = getBatteryLevel(context);

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        String now = sdf.format(new Date());

        // Check if user is using Direct Supabase (recommended) or Custom Gateway
        boolean isSupabase = baseUrl.contains("supabase.co");

        if (isSupabase) {
            return sendDirectSupabaseTelemetry(imei, lat, lng, speedKm, (int) bearing, (int) altitude, battery, now);
        }

        // Custom Server (e.g. Vercel or Custom VPS API)
        try {
            String fullUrl = baseUrl.replaceAll("/+$", "") + "/api/mobile/telemetry";
            URL url = new URL(fullUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            JSONObject json = new JSONObject();
            json.put("imei", imei);
            json.put("lat", lat);
            json.put("lng", lng);
            json.put("speed", speedKm);
            json.put("heading", (int) bearing);
            json.put("altitude", (int) altitude);
            json.put("battery_level", battery);
            json.put("gsm_signal", 95);
            json.put("recorded_at", now);

            LogManager.info("HTTP", String.format(Locale.US, "ارسال به %s | کد: %s | مختصات: %.5f, %.5f",
                    fullUrl, imei, lat, lng));

            byte[] input = json.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            String responseBody = readStream(conn, code);
            conn.disconnect();

            if (code >= 200 && code < 300) {
                LogManager.success("HTTP " + code, "✓ ثبت موفق در سرور و دیتابیس: " + responseBody);
                return new TelemetryResult(true, code, responseBody, null);
            } else {
                LogManager.warning("HTTP " + code, "پاسخ ناموفق سرور واسط. سوئیچ خودکار به اتصال مستقیم دیتابیس...");
                // Seamless fallback to Supabase Direct
                return sendDirectSupabaseTelemetry(imei, lat, lng, speedKm, (int) bearing, (int) altitude, battery, now);
            }
        } catch (Exception e) {
            LogManager.warning("NETWORK", "خطای شبکه سرور واسط (" + e.getMessage() + ")؛ سوئیچ خودکار به اتصال مستقیم دیتابیس...");
            // Seamless fallback to Supabase Direct
            return sendDirectSupabaseTelemetry(imei, lat, lng, speedKm, (int) bearing, (int) altitude, battery, now);
        }
    }

    /**
     * Direct Supabase REST Telemetry Insertion (Option A)
     * Direct, ultra-fast, zero-middleman, authenticated via Supabase public key.
     */
    private static TelemetryResult sendDirectSupabaseTelemetry(String imei, double lat, double lng, int speedKm, int heading, int altitude, int battery, String now) {
        try {
            String fullUrl = SUPABASE_REST_BASE + "/rest/v1/gps_telemetry";
            URL url = new URL(fullUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Prefer", "return=representation");
            conn.setDoOutput(true);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            JSONObject json = new JSONObject();
            json.put("device_imei", imei);
            json.put("lat", lat);
            json.put("lng", lng);
            json.put("speed", speedKm);
            json.put("heading", heading);
            json.put("altitude", altitude);
            json.put("battery_level", battery);
            json.put("gsm_signal", 95);
            json.put("ignition", speedKm > 0 || true);
            json.put("satellites", 12);
            json.put("recorded_at", now);

            LogManager.info("SUPABASE", String.format(Locale.US, "ارسال مستقیم به دیتابیس | دستگاه: %s | مختصات: %.5f, %.5f",
                    imei, lat, lng));

            byte[] input = json.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            String responseBody = readStream(conn, code);
            conn.disconnect();

            if (code >= 200 && code < 300) {
                LogManager.success("HTTP " + code, "✓ ثبت موفق و مستقیم در پایگاه‌داده Supabase (زنده)");
                // Update device status to online in background
                updateDeviceStatusAsync(imei, now);
                return new TelemetryResult(true, code, responseBody, null);
            } else {
                LogManager.error("HTTP " + code, "خطای دیتابیس Supabase: " + responseBody);
                return new TelemetryResult(false, code, responseBody, "کد پاسخ: " + code);
            }
        } catch (Exception e) {
            String err = e.getClass().getSimpleName() + ": " + e.getMessage();
            Log.e(TAG, "sendDirectSupabaseTelemetry failed: " + err);
            LogManager.error("NETWORK", "خطای اتصال مستقیم به دیتابیس: " + err);
            return new TelemetryResult(false, -1, null, err);
        }
    }

    private static void updateDeviceStatusAsync(String imei, String now) {
        new Thread(() -> {
            try {
                // Update devices status
                String patchUrl = SUPABASE_REST_BASE + "/rest/v1/devices?imei=eq." + imei;
                URL url = new URL(patchUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
                conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                conn.setDoOutput(true);
                conn.setConnectTimeout(5000);

                JSONObject json = new JSONObject();
                json.put("status", "online");
                json.put("last_online", now);

                byte[] input = json.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(input, 0, input.length);
                }
                conn.getResponseCode();
                conn.disconnect();
            } catch (Exception ignored) {}
        }).start();
    }

    public static boolean sendSecurityEvent(Context context, String eventType, String newSimNumber, String photoUrl, double lat, double lng) {
        try {
            String imei = getDeviceImei(context);
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
            String now = sdf.format(new Date());

            String fullUrl = SUPABASE_REST_BASE + "/rest/v1/alerts";
            URL url = new URL(fullUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Prefer", "return=representation");
            conn.setDoOutput(true);
            conn.setConnectTimeout(8000);

            String title = "هشدار امنیتی ردیاب گوشی";
            if ("sim_changed".equals(eventType)) title = "🚨 هشدار تعویض سیمکارت غیرمجاز";
            else if ("panic_siren".equals(eventType)) title = "🔊 پخش آژیر اضطراری ضد سرقت";
            else if ("failed_unlock".equals(eventType)) title = "📸 تلاش ناموفق برای باز کردن قفل صفحه";

            String desc = "شناسه دستگاه: " + imei;
            if (newSimNumber != null) desc += " | شماره سیمکارت جدید: " + newSimNumber;
            if (photoUrl != null) desc += " | تصویر متجاوز: " + photoUrl;

            JSONObject json = new JSONObject();
            json.put("device_imei", imei);
            json.put("alert_type", eventType);
            json.put("title", title);
            json.put("description", desc);
            if (lat != 0 && lng != 0) {
                json.put("lat", lat);
                json.put("lng", lng);
            }
            json.put("created_at", now);

            byte[] input = json.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            conn.disconnect();
            return code >= 200 && code < 300;
        } catch (Exception e) {
            Log.e(TAG, "sendSecurityEvent failed: " + e.getMessage());
            return false;
        }
    }

    private static String readStream(HttpURLConnection conn, int code) {
        try {
            java.io.InputStream stream = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
            if (stream != null) {
                java.util.Scanner s = new java.util.Scanner(stream, "UTF-8").useDelimiter("\\A");
                String res = s.hasNext() ? s.next() : "";
                stream.close();
                return res;
            }
        } catch (Exception ignored) {}
        return "";
    }
}
