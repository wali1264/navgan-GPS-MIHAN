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

    public static String getServerUrl(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getString("server_url", "https://your-fleet-server.com");
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

    /**
     * Checks if a detected SIM ICCID is present in the owner's authorized SIM whitelist.
     * Supports single-SIM and dual-SIM smartphones (ICCIDs separated by comma).
     */
    public static boolean isSimAuthorized(Context context, String detectedIccid) {
        if (detectedIccid == null || detectedIccid.trim().isEmpty()) {
            return true; // Cannot determine, do not trigger false alarm
        }
        String registeredIccids = getRegisteredIccid(context);
        if (registeredIccids == null || registeredIccids.trim().isEmpty()) {
            return true; // Whitelist not configured yet, no false alarm
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
        try {
            String baseUrl = getServerUrl(context);
            if (baseUrl == null || baseUrl.isEmpty() || baseUrl.contains("your-fleet-server.com")) {
                LogManager.warning("HTTP", "آدرس سرور هنوز تنظیم نشده است.");
                return new TelemetryResult(false, 0, null, "آدرس سرور تنظیم نشده است");
            }

            String fullUrl = baseUrl.replaceAll("/+$", "") + "/api/mobile/telemetry";
            String imei = getDeviceImei(context);

            URL url = new URL(fullUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(9000);
            conn.setReadTimeout(9000);

            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
            String now = sdf.format(new Date());

            int speedKm = (int) (speed * 3.6f);
            int battery = getBatteryLevel(context);

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

            LogManager.info("HTTP", String.format(Locale.US, "ارسال به %s | کد: %s | مختصات: %.5f, %.5f | باتری: %d%%",
                    fullUrl, imei, lat, lng, battery));

            byte[] input = json.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            String responseBody = "";
            java.io.InputStream stream = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
            if (stream != null) {
                java.util.Scanner s = new java.util.Scanner(stream, "UTF-8").useDelimiter("\\A");
                responseBody = s.hasNext() ? s.next() : "";
                stream.close();
            }

            conn.disconnect();

            if (code >= 200 && code < 300) {
                LogManager.success("HTTP " + code, "✓ ثبت موفق در سرور و دیتابیس: " + responseBody);
                return new TelemetryResult(true, code, responseBody, null);
            } else {
                LogManager.error("HTTP " + code, "خطا از سمت سرور: " + responseBody);
                return new TelemetryResult(false, code, responseBody, "کد پاسخ: " + code);
            }
        } catch (Exception e) {
            String err = e.getClass().getSimpleName() + ": " + e.getMessage();
            Log.e(TAG, "sendTelemetry failed: " + err);
            LogManager.error("NETWORK", "خطای اتصال به سرور: " + err);
            return new TelemetryResult(false, -1, null, err);
        }
    }

    public static boolean sendSecurityEvent(Context context, String eventType, String newSimNumber, String photoUrl, double lat, double lng) {
        try {
            String baseUrl = getServerUrl(context);
            if (baseUrl == null || baseUrl.isEmpty() || baseUrl.contains("your-fleet-server.com")) {
                return false;
            }

            URL url = new URL(baseUrl.replaceAll("/+$", "") + "/api/mobile/security-event");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; utf-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);

            JSONObject json = new JSONObject();
            json.put("imei", getDeviceImei(context));
            json.put("event_type", eventType);
            if (newSimNumber != null) json.put("new_sim_number", newSimNumber);
            if (photoUrl != null) json.put("photo_url", photoUrl);
            if (lat != 0 && lng != 0) {
                json.put("lat", lat);
                json.put("lng", lng);
            }

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
}
