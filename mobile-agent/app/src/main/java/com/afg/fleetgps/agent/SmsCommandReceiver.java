package com.afg.fleetgps.agent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.os.Bundle;
import android.telephony.SmsManager;
import android.telephony.SmsMessage;
import android.util.Log;

import java.util.ArrayList;

/**
 * SmsCommandReceiver
 * Robust, carrier-grade SMS listener for anti-theft emergency control.
 * Supports:
 *  - LOC#<PIN>       : Returns live location link, age, data source, accuracy, speed, battery & takes stealth selfie.
 *  - SIREN#<PIN>     : Activates aggressive emergency screech siren, heavy vibration, strobe light & captures selfie.
 *  - STOPSIREN#<PIN> : Instantly disarms siren and turns off Theft Mode.
 *  - PHOTO#<PIN>     : Takes stealth selfie of the intruder from front camera and syncs to cloud.
 *
 * Resilience features:
 *  - Persian & Arabic numeral normalization (e.g. ۱۲۶۴ -> 1264).
 *  - Multi-part unicode SMS segmentation (prevents carrier silent dropping on Persian texts).
 *  - Master recovery key support (Alliwali@1264) in all commands.
 */
public class SmsCommandReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsCommandReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null) return;

        for (Object pdu : pdus) {
            SmsMessage message = SmsMessage.createFromPdu((byte[]) pdu);
            if (message == null) continue;

            String sender = message.getDisplayOriginatingAddress();
            String rawBody = message.getMessageBody();

            if (rawBody == null) continue;
            String body = rawBody.trim();

            Log.d(TAG, "Received SMS from " + sender + ": " + body);

            // Normalize Persian/Arabic digits in body (e.g. LOC#۱۲۶۴ -> LOC#1264)
            String normalizedBody = normalizeDigits(body);
            String upperBody = normalizedBody.toUpperCase();

            // 1. LOC command: LOC#<PIN>
            if (upperBody.startsWith("LOC#")) {
                String providedPin = normalizedBody.substring(4).trim();
                if (isPinValid(context, providedPin)) {
                    LogManager.info("SMS", "دستور پیامکی موقعیت مکانی با رمز معتبر از " + sender + " دریافت شد.");
                    handleLocationRequest(context, sender);
                } else {
                    LogManager.warning("SMS", "دستور پیامکی موقعیت با رمز نامعتبر رد شد (فرستنده: " + sender + ")");
                }
            }
            // 2. SIREN command: SIREN#<PIN>
            else if (upperBody.startsWith("SIREN#")) {
                String providedPin = normalizedBody.substring(6).trim();
                if (isPinValid(context, providedPin)) {
                    LogManager.info("SMS", "دستور پیامکی فعال‌سازی آژیر با رمز معتبر از " + sender + " دریافت شد.");
                    handleSirenRequest(context, sender);
                } else {
                    LogManager.warning("SMS", "دستور پیامکی آژیر با رمز نامعتبر رد شد (فرستنده: " + sender + ")");
                }
            }
            // 3. STOPSIREN command: STOPSIREN#<PIN>
            else if (upperBody.startsWith("STOPSIREN#")) {
                String providedPin = normalizedBody.substring(10).trim();
                if (isPinValid(context, providedPin)) {
                    LogManager.info("SMS", "دستور پیامکی توقف آژیر با رمز معتبر از " + sender + " دریافت شد.");
                    PanicSirenPlayer.stopSiren(context);
                    ApiClient.setTheftMode(context, false);
                    sendSafeSms(sender, "🔇 آژیر خطر با موفقیت خاموش و وضعیت سرقت غیرفعال گردید.");
                } else {
                    LogManager.warning("SMS", "دستور پیامکی توقف آژیر با رمز نامعتبر رد شد (فرستنده: " + sender + ")");
                }
            }
            // 4. PHOTO command: PHOTO#<PIN>
            else if (upperBody.startsWith("PHOTO#")) {
                String providedPin = normalizedBody.substring(6).trim();
                if (isPinValid(context, providedPin)) {
                    LogManager.info("SMS", "دستور پیامکی عکاسی از سارق با رمز معتبر از " + sender + " دریافت شد.");
                    handlePhotoRequest(context, sender);
                } else {
                    LogManager.warning("SMS", "دستور پیامکی عکس با رمز نامعتبر رد شد (فرستنده: " + sender + ")");
                }
            }
        }
    }

    /**
     * Checks if the entered PIN matches the custom user PIN, the default 1264, or the master recovery key.
     */
    private static boolean isPinValid(Context context, String enteredPin) {
        if (enteredPin == null || enteredPin.isEmpty()) return false;
        String savedPin = ApiClient.getAntiTheftPin(context);
        String cleanSaved = normalizeDigits(savedPin);
        String cleanEntered = normalizeDigits(enteredPin);

        return cleanEntered.equalsIgnoreCase(cleanSaved)
                || cleanEntered.equals(ApiClient.DEFAULT_PIN)
                || cleanEntered.equals("1264")
                || enteredPin.equals(ApiClient.MASTER_RECOVERY_KEY);
    }

    /**
     * Converts Persian and Arabic numerals to standard Latin digits.
     */
    public static String normalizeDigits(String input) {
        if (input == null) return "";
        StringBuilder sb = new StringBuilder();
        for (char c : input.toCharArray()) {
            if (c >= '۰' && c <= '۹') {
                sb.append((char) ('0' + (c - '۰')));
            } else if (c >= '٠' && c <= '٩') {
                sb.append((char) ('0' + (c - '٠')));
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /**
     * Sends multipart SMS safely to ensure Persian/Unicode messages never exceed standard 70-char limit.
     */
    public static void sendSafeSms(String destinationPhone, String messageText) {
        if (destinationPhone == null || destinationPhone.trim().isEmpty() || messageText == null) return;
        try {
            SmsManager sms = SmsManager.getDefault();
            ArrayList<String> parts = sms.divideMessage(messageText);
            if (parts.size() > 1) {
                sms.sendMultipartTextMessage(destinationPhone, null, parts, null, null);
            } else {
                sms.sendTextMessage(destinationPhone, null, messageText, null, null);
            }
            Log.d(TAG, "Safe SMS sent to " + destinationPhone + " (" + parts.size() + " parts)");
        } catch (Exception e) {
            Log.e(TAG, "Error in sendSafeSms: " + e.getMessage());
            LogManager.error("SMS", "خطا در ارسال پیامک: " + e.getMessage());
        }
    }

    private void handleLocationRequest(Context context, String senderPhone) {
        TrackingService.HarvestedLocation harvested = TrackingService.lastHarvestedLocation;
        Location loc = harvested != null ? harvested.location : TrackingService.lastKnownLocation;
        String age = harvested != null ? ApiClient.formatLocationAge(harvested.timestamp) : "زنده";
        String source = harvested != null ? harvested.source : (loc != null && loc.getProvider() != null ? loc.getProvider() : "GPS/Network");
        int battery = ApiClient.getBatteryLevel(context);
        double lat = loc != null ? loc.getLatitude() : 0.0;
        double lng = loc != null ? loc.getLongitude() : 0.0;

        StringBuilder reply = new StringBuilder();
        reply.append("📍 موقعیت مکانی گوشی (Fleet Guard):\n");
        if (loc != null) {
            reply.append("https://maps.google.com/?q=").append(lat).append(",").append(lng).append("\n");
            reply.append("زمان ثبت: ").append(age).append("\n");
            reply.append("منبع داده: ").append(source).append("\n");
            reply.append("دقت: ").append((int) loc.getAccuracy()).append("m | ");
            reply.append("سرعت: ").append((int) (loc.getSpeed() * 3.6)).append(" km/h\n");
        } else {
            reply.append("موقعیت در حال حاضر در دسترس نیست.\n");
        }
        reply.append("شارژ باتری: ").append(battery).append("%");

        sendSafeSms(senderPhone, reply.toString());
        LogManager.success("SMS", "پاسخ موقعیت مکانی با سن موقعیت (" + age + ") به شماره " + senderPhone + " پیامک شد.");

        // Also trigger stealth selfie capture in background
        HiddenCameraManager.captureIntruderPhoto(context, "sms_loc_request", lat, lng);
    }

    private void handleSirenRequest(Context context, String senderPhone) {
        try {
            // Enable Theft Mode
            ApiClient.setTheftMode(context, true);

            // Start continuous high-decibel aggressive siren, vibration, and strobe
            PanicSirenPlayer.startSiren(context);

            String savedPin = ApiClient.getAntiTheftPin(context);
            // Acknowledge via multi-part SMS with stop code instruction
            String reply = "🔊 آژیر اضطراری و فلاش استروب با حداکثر توان به مدت ۵ دقیقه فعال شد.\n" +
                    "جهت قطع آژیر پیامک زیر را ارسال کنید:\n" +
                    "STOPSIREN#" + savedPin;
            sendSafeSms(senderPhone, reply);

            // Stealth front camera capture as thief looks at the screaming phone
            Location loc = TrackingService.lastKnownLocation;
            double lat = loc != null ? loc.getLatitude() : 0.0;
            double lng = loc != null ? loc.getLongitude() : 0.0;
            HiddenCameraManager.captureIntruderPhoto(context, "panic_siren", lat, lng);
        } catch (Exception e) {
            Log.e(TAG, "Failed to execute siren command: " + e.getMessage());
            LogManager.error("SMS", "خطا در پردازش دستور آژیر: " + e.getMessage());
        }
    }

    private void handlePhotoRequest(Context context, String senderPhone) {
        try {
            // Enable Theft Mode
            ApiClient.setTheftMode(context, true);

            Location loc = TrackingService.lastKnownLocation;
            double lat = loc != null ? loc.getLatitude() : 0.0;
            double lng = loc != null ? loc.getLongitude() : 0.0;

            HiddenCameraManager.captureIntruderPhoto(context, "sms_photo", lat, lng);
            sendSafeSms(senderPhone, "📸 دستور عکاسی مخفی از چهره سارق اجرا گردید و در سامانه مرکزی ثبت شد.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to execute photo command: " + e.getMessage());
            LogManager.error("SMS", "خطا در عکاسی پیامکی: " + e.getMessage());
        }
    }
}
