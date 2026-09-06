package com.afg.fleetgps.agent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Bundle;
import android.telephony.SmsManager;
import android.telephony.SmsMessage;
import android.util.Log;

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
            String body = message.getMessageBody();

            if (body == null) continue;
            body = body.trim();

            Log.d(TAG, "Received SMS from " + sender + ": " + body);

            String savedPin = ApiClient.getAntiTheftPin(context);
            String upperBody = body.toUpperCase();

            // Command format: LOC#<PIN> (e.g. LOC#1234)
            if (upperBody.startsWith("LOC#")) {
                String providedPin = body.substring(4).trim();
                if (providedPin.equalsIgnoreCase(savedPin) || savedPin.isEmpty()) {
                    LogManager.info("SMS", "دستور پیامکی موقعیت مکانی با رمز معتبر از " + sender + " دریافت گردید.");
                    handleLocationRequest(context, sender);
                } else {
                    LogManager.warning("SMS", "دستور پیامکی با رمز نامعتبر رد شد (فرستنده: " + sender + ")");
                }
            } else if (upperBody.startsWith("SIREN#")) {
                String providedPin = body.substring(6).trim();
                if (providedPin.equalsIgnoreCase(savedPin) || savedPin.isEmpty()) {
                    LogManager.info("SMS", "دستور پیامکی فعال‌سازی آژیر با رمز معتبر از " + sender + " دریافت گردید.");
                    handleSirenRequest(context, sender);
                } else {
                    LogManager.warning("SMS", "دستور آژیر با رمز نامعتبر رد شد (فرستنده: " + sender + ")");
                }
            } else if (upperBody.startsWith("STOPSIREN#")) {
                String providedPin = body.substring(10).trim();
                if (providedPin.equalsIgnoreCase(savedPin) || savedPin.isEmpty()) {
                    LogManager.info("SMS", "دستور توقف آژیر با رمز معتبر از " + sender + " دریافت گردید.");
                    PanicSirenPlayer.stopSiren(context);
                    try {
                        SmsManager.getDefault().sendTextMessage(sender, null, "🔇 آژیر خطر با موفقیت خاموش و متوقف گردید.", null, null);
                    } catch (Exception ignored) {}
                } else {
                    LogManager.warning("SMS", "دستور توقف آژیر با رمز نامعتبر رد شد (فرستنده: " + sender + ")");
                }
            }
        }
    }

    private void handleLocationRequest(Context context, String senderPhone) {
        TrackingService.HarvestedLocation harvested = TrackingService.lastHarvestedLocation;
        Location loc = harvested != null ? harvested.location : TrackingService.lastKnownLocation;
        String age = harvested != null ? ApiClient.formatLocationAge(harvested.timestamp) : "زنده";
        String source = harvested != null ? harvested.source : (loc != null && loc.getProvider() != null ? loc.getProvider() : "GPS/Network");
        int battery = ApiClient.getBatteryLevel(context);

        StringBuilder reply = new StringBuilder();
        reply.append("📍 موقعیت مکانی گوشی (Fleet Guard):\n");
        if (loc != null) {
            reply.append("https://maps.google.com/?q=").append(loc.getLatitude()).append(",").append(loc.getLongitude()).append("\n");
            reply.append("زمان ثبت: ").append(age).append("\n");
            reply.append("منبع داده: ").append(source).append("\n");
            reply.append("دقت: ").append((int) loc.getAccuracy()).append("m | ");
            reply.append("سرعت: ").append((int) (loc.getSpeed() * 3.6)).append(" km/h\n");
        } else {
            reply.append("موقعیت در حال حاضر در دسترس نیست.\n");
        }
        reply.append("شارژ باتری: ").append(battery).append("%");

        try {
            SmsManager sms = SmsManager.getDefault();
            sms.sendTextMessage(senderPhone, null, reply.toString(), null, null);
            Log.d(TAG, "Location SMS reply sent to " + senderPhone);
            LogManager.success("SMS", "پاسخ موقعیت مکانی با سن موقعیت (" + age + ") به شماره " + senderPhone + " پیامک شد.");
        } catch (Exception e) {
            Log.e(TAG, "Error sending SMS reply: " + e.getMessage());
            LogManager.error("SMS", "خطا در ارسال پاسخ پیامک: " + e.getMessage());
        }
    }

    private void handleSirenRequest(Context context, String senderPhone) {
        try {
            // Start continuous high-decibel sweep siren via PanicSirenPlayer
            PanicSirenPlayer.startSiren(context);

            String savedPin = ApiClient.getAntiTheftPin(context);
            // Acknowledge via SMS with stop code instruction
            String reply = "🔊 آژیر خطر با حداکثر توان بلندگو به مدت ۵ دقیقه فعال گردید.\n" +
                    "جهت قطع آژیر پیامک زیر را بفرستید:\n" +
                    "STOPSIREN#" + savedPin;
            SmsManager.getDefault().sendTextMessage(senderPhone, null, reply, null, null);

            // Report event to server
            new Thread(() -> {
                Location loc = TrackingService.lastKnownLocation;
                double lat = loc != null ? loc.getLatitude() : 0.0;
                double lng = loc != null ? loc.getLongitude() : 0.0;
                ApiClient.sendSecurityEvent(context, "panic_siren", null, null, lat, lng);
            }).start();
        } catch (Exception e) {
            Log.e(TAG, "Failed to execute siren command: " + e.getMessage());
        }
    }
}
