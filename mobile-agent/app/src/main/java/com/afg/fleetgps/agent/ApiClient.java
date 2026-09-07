package com.afg.fleetgps.agent;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.BatteryManager;
import android.os.Build;
import android.telephony.CellIdentityGsm;
import android.telephony.CellIdentityLte;
import android.telephony.CellIdentityWcdma;
import android.telephony.CellInfo;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoWcdma;
import android.telephony.TelephonyManager;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
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

    public static final String MASTER_RECOVERY_KEY = "Alliwali@1264";
    public static final String DEFAULT_PIN = "1264";

    public static String getAntiTheftPin(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getString("anti_theft_pin", DEFAULT_PIN);
    }

    public static void saveAntiTheftPin(Context context, String pin) {
        if (pin == null || pin.trim().isEmpty()) pin = DEFAULT_PIN;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString("anti_theft_pin", pin.trim()).apply();
    }

    public static void resetAntiTheftPinToDefault(Context context) {
        saveAntiTheftPin(context, DEFAULT_PIN);
    }

    public static boolean isPowerLockEnabled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean("anti_theft_power_lock_enabled", false);
    }

    public static void setPowerLockEnabled(Context context, boolean enabled) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("anti_theft_power_lock_enabled", enabled).apply();
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

    public static int getHarvestIntervalSeconds(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getInt("harvest_engine_interval_sec", 30);
    }

    public static void setHarvestIntervalSeconds(Context context, int seconds) {
        if (seconds < 5) seconds = 5;
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putInt("harvest_engine_interval_sec", seconds).apply();
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

    public static boolean isTheftMode(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean("is_theft_mode", false);
    }

    public static void setTheftMode(Context context, boolean enabled) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("is_theft_mode", enabled).apply();
        if (enabled) {
            LogManager.warning("SECURITY", "⚠️ وضعیت قرمز سرقت (Theft Mode) روی دستگاه فعال گردید!");
        } else {
            LogManager.info("SECURITY", "وضعیت سرقت (Theft Mode) لغو شد و دستگاه به حالت عادی برگشت.");
            resetFailedPinAttempts(context);
        }
    }

    public static int getFailedPinAttempts(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getInt("failed_pin_attempts", 0);
    }

    public static int incrementFailedPinAttempts(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        int count = prefs.getInt("failed_pin_attempts", 0) + 1;
        prefs.edit().putInt("failed_pin_attempts", count).apply();
        return count;
    }

    public static void resetFailedPinAttempts(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putInt("failed_pin_attempts", 0).apply();
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

            LogManager.info("DATABASE", String.format(Locale.US, "ارسال مستقیم به دیتابیس | دستگاه: %s | مختصات: %.5f, %.5f",
                    imei, lat, lng));

            byte[] input = json.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(input, 0, input.length);
            }

            int code = conn.getResponseCode();
            String responseBody = readStream(conn, code);
            conn.disconnect();

            if (code >= 200 && code < 300) {
                LogManager.success("HTTP " + code, "✓ ثبت موفق و مستقیم در پایگاه‌داده ابری (زنده)");
                // Update device status to online in background
                updateDeviceStatusAsync(imei, now);
                return new TelemetryResult(true, code, responseBody, null);
            } else {
                LogManager.error("HTTP " + code, "خطای پایگاه‌داده ابری: " + responseBody);
                return new TelemetryResult(false, code, responseBody, "کد پاسخ: " + code);
            }
        } catch (Exception e) {
            String err = e.getClass().getSimpleName() + ": " + e.getMessage();
            Log.e(TAG, "sendDirectSupabaseTelemetry failed: " + err);
            LogManager.error("NETWORK", "خطای اتصال مستقیم به دیتابیس: " + err);
            return new TelemetryResult(false, -1, null, err);
        }
    }

    public static class CellInfoDetail {
        public final int mcc;
        public final int mnc;
        public final int lac;
        public final int cid;
        public final int dbm;
        public final String type;
        public final String operatorName;

        public CellInfoDetail(int mcc, int mnc, int lac, int cid, int dbm, String type, String operatorName) {
            this.mcc = mcc;
            this.mnc = mnc;
            this.lac = lac;
            this.cid = cid;
            this.dbm = dbm;
            this.type = type;
            this.operatorName = operatorName;
        }

        public boolean isValid() {
            return cid > 0 && cid != Integer.MAX_VALUE && cid != 0xFFFF && cid != 0xFFFFFFF && cid != -1;
        }

        public String getDisplaySummary() {
            String op = (operatorName != null && !operatorName.isEmpty()) ? operatorName : "دکل مخابراتی";
            return String.format(Locale.US, "%s [CID: %d | LAC: %d | %s | %d dBm]",
                    op, cid, lac, type, dbm);
        }
    }

    @SuppressLint("MissingPermission")
    public static CellInfoDetail getActiveCellInfo(Context context) {
        try {
            TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
            if (tm == null) return null;

            String opName = tm.getNetworkOperatorName();
            String simOp = tm.getNetworkOperator();
            int defaultMcc = 412; // Afghanistan MCC default
            int defaultMnc = 1;
            if (simOp != null && simOp.length() >= 5) {
                try {
                    defaultMcc = Integer.parseInt(simOp.substring(0, 3));
                    defaultMnc = Integer.parseInt(simOp.substring(3));
                } catch (Exception ignored) {}
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
                List<CellInfo> cellInfos = tm.getAllCellInfo();
                if (cellInfos != null) {
                    for (CellInfo info : cellInfos) {
                        if (!info.isRegistered()) continue; // Focus on the connected/serving cell
                        if (info instanceof CellInfoLte) {
                            CellInfoLte lte = (CellInfoLte) info;
                            CellIdentityLte id = lte.getCellIdentity();
                            int mcc = defaultMcc;
                            int mnc = defaultMnc;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                if (id.getMccString() != null) mcc = Integer.parseInt(id.getMccString());
                                if (id.getMncString() != null) mnc = Integer.parseInt(id.getMncString());
                            } else {
                                mcc = id.getMcc() > 0 ? id.getMcc() : defaultMcc;
                                mnc = id.getMnc() > 0 ? id.getMnc() : defaultMnc;
                            }
                            int cid = id.getCi();
                            int tac = id.getTac();
                            int dbm = lte.getCellSignalStrength().getDbm();
                            if (cid > 0 && cid != Integer.MAX_VALUE) {
                                return new CellInfoDetail(mcc, mnc, tac, cid, dbm, "LTE (4G)", opName);
                            }
                        } else if (info instanceof CellInfoGsm) {
                            CellInfoGsm gsm = (CellInfoGsm) info;
                            CellIdentityGsm id = gsm.getCellIdentity();
                            int mcc = defaultMcc;
                            int mnc = defaultMnc;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                if (id.getMccString() != null) mcc = Integer.parseInt(id.getMccString());
                                if (id.getMncString() != null) mnc = Integer.parseInt(id.getMncString());
                            } else {
                                mcc = id.getMcc() > 0 ? id.getMcc() : defaultMcc;
                                mnc = id.getMnc() > 0 ? id.getMnc() : defaultMnc;
                            }
                            int cid = id.getCid();
                            int lac = id.getLac();
                            int dbm = gsm.getCellSignalStrength().getDbm();
                            if (cid > 0 && cid != Integer.MAX_VALUE) {
                                return new CellInfoDetail(mcc, mnc, lac, cid, dbm, "GSM (2G)", opName);
                            }
                        } else if (info instanceof CellInfoWcdma) {
                            CellInfoWcdma wcdma = (CellInfoWcdma) info;
                            CellIdentityWcdma id = wcdma.getCellIdentity();
                            int mcc = defaultMcc;
                            int mnc = defaultMnc;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                if (id.getMccString() != null) mcc = Integer.parseInt(id.getMccString());
                                if (id.getMncString() != null) mnc = Integer.parseInt(id.getMncString());
                            } else {
                                mcc = id.getMcc() > 0 ? id.getMcc() : defaultMcc;
                                mnc = id.getMnc() > 0 ? id.getMnc() : defaultMnc;
                            }
                            int cid = id.getCid();
                            int lac = id.getLac();
                            int dbm = wcdma.getCellSignalStrength().getDbm();
                            if (cid > 0 && cid != Integer.MAX_VALUE) {
                                return new CellInfoDetail(mcc, mnc, lac, cid, dbm, "3G (WCDMA)", opName);
                            }
                        }
                    }
                }
            }

            // Legacy fallback if getAllCellInfo() is empty
            android.telephony.CellLocation cellLoc = tm.getCellLocation();
            if (cellLoc instanceof android.telephony.gsm.GsmCellLocation) {
                android.telephony.gsm.GsmCellLocation gsmLoc = (android.telephony.gsm.GsmCellLocation) cellLoc;
                int cid = gsmLoc.getCid();
                int lac = gsmLoc.getLac();
                if (cid > 0 && cid != -1) {
                    return new CellInfoDetail(defaultMcc, defaultMnc, lac, cid, -75, "Cellular", opName);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to inspect active cell tower: " + e.getMessage());
        }
        return null;
    }

    /**
     * Resolves Cell Tower ID to Geographic Coordinates using compatible Geolocation APIs.
     */
    public static Location resolveCellLocation(Context context, CellInfoDetail cell) {
        if (cell == null || !cell.isValid()) return null;
        try {
            // Standard multi-carrier Geolocation resolver
            String geoUrl = "https://location.services.mozilla.com/v1/geolocate?key=test";
            URL url = new URL(geoUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setDoOutput(true);
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);

            JSONObject body = new JSONObject();
            JSONArray cells = new JSONArray();
            JSONObject c = new JSONObject();
            c.put("radioType", cell.type.contains("4G") || cell.type.contains("LTE") ? "lte" : (cell.type.contains("3G") ? "wcdma" : "gsm"));
            c.put("mobileCountryCode", cell.mcc);
            c.put("mobileNetworkCode", cell.mnc);
            c.put("locationAreaCode", cell.lac);
            c.put("cellId", cell.cid);
            c.put("signalStrength", cell.dbm);
            cells.put(c);
            body.put("cellTowers", cells);

            byte[] b = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(b, 0, b.length);
            }

            int code = conn.getResponseCode();
            if (code >= 200 && code < 300) {
                String resp = readStream(conn, code);
                conn.disconnect();
                JSONObject resJson = new JSONObject(resp);
                JSONObject locObj = resJson.getJSONObject("location");
                double lat = locObj.getDouble("lat");
                double lng = locObj.getDouble("lng");
                double acc = resJson.optDouble("accuracy", 750.0);

                Location loc = new Location("cell_tower");
                loc.setLatitude(lat);
                loc.setLongitude(lng);
                loc.setAccuracy((float) acc);
                loc.setTime(System.currentTimeMillis());
                return loc;
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.w(TAG, "Cell tower geolocation lookup error: " + e.getMessage());
        }
        return null;
    }

    public static void updateDeviceStatusAsync(String imei, String now) {
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

            // 1. Primary insert into dedicated mobile_security_events table (stores high-res Base64 photo)
            try {
                String secUrl = SUPABASE_REST_BASE + "/rest/v1/mobile_security_events";
                URL url = new URL(secUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                conn.setRequestProperty("Prefer", "return=representation");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);

                JSONObject secJson = new JSONObject();
                secJson.put("device_imei", imei);
                secJson.put("event_type", eventType);
                if (photoUrl != null && !photoUrl.isEmpty()) {
                    secJson.put("photo_url", photoUrl);
                }
                if (newSimNumber != null) {
                    secJson.put("new_sim_number", newSimNumber);
                }
                if (lat != 0 && lng != 0) {
                    secJson.put("lat", lat);
                    secJson.put("lng", lng);
                }
                JSONObject details = new JSONObject();
                details.put("battery", getBatteryLevel(context));
                details.put("event_type", eventType);
                details.put("has_photo", photoUrl != null && !photoUrl.isEmpty());
                secJson.put("details", details);
                secJson.put("created_at", now);

                byte[] secBytes = secJson.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(secBytes, 0, secBytes.length);
                }
                int secCode = conn.getResponseCode();
                conn.disconnect();
                Log.d(TAG, "mobile_security_events response code: " + secCode);
            } catch (Exception ex) {
                Log.e(TAG, "Failed inserting to mobile_security_events: " + ex.getMessage());
            }

            // 2. Also insert headline into alerts table for notification center
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
            else if ("failed_unlock".equals(eventType) || "failed_unlock_3times".equals(eventType)) title = "📸 تلاش ناموفق برای باز کردن قفل صفحه (۳ بار خطا)";
            else if ("sms_photo".equals(eventType)) title = "📸 تصویر ارسالی با دستور پیامکی";
            else if ("screen_on_theft_mode".equals(eventType)) title = "📸 ثبت چهره سارق هنگام روشن شدن صفحه";

            String desc = "شناسه دستگاه: " + imei;
            if (newSimNumber != null) desc += " | شماره سیمکارت جدید: " + newSimNumber;
            if (photoUrl != null && !photoUrl.isEmpty()) desc += " | [عکس چهره متجاوز ثبت گردید]";

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
