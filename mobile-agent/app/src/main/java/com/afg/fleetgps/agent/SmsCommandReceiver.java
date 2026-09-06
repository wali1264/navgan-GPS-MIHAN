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

            if (body.toUpperCase().startsWith("LOC#")) {
                handleLocationRequest(context, sender);
            } else if (body.toUpperCase().startsWith("SIREN#")) {
                handleSirenRequest(context, sender);
            }
        }
    }

    private void handleLocationRequest(Context context, String senderPhone) {
        Location loc = TrackingService.lastKnownLocation;
        int battery = ApiClient.getBatteryLevel(context);

        StringBuilder reply = new StringBuilder();
        reply.append("📍 موقعیت مکانی فعلی گوشی:\n");
        if (loc != null) {
            reply.append("https://maps.google.com/?q=").append(loc.getLatitude()).append(",").append(loc.getLongitude()).append("\n");
            reply.append("دقت: ").append((int) loc.getAccuracy()).append(" متر\n");
            reply.append("سرعت: ").append((int) (loc.getSpeed() * 3.6)).append(" km/h\n");
        } else {
            reply.append("در انتظار دریافت سیگنال GPS ماهواره‌ای...\n");
        }
        reply.append("شارژ باتری: ").append(battery).append("%");

        try {
            SmsManager sms = SmsManager.getDefault();
            sms.sendTextMessage(senderPhone, null, reply.toString(), null, null);
            Log.d(TAG, "Location SMS reply sent to " + senderPhone);
        } catch (Exception e) {
            Log.e(TAG, "Error sending SMS reply: " + e.getMessage());
        }
    }

    private void handleSirenRequest(Context context, String senderPhone) {
        try {
            // Force maximum volume even if phone is on mute/vibrate
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVolume, 0);
            }

            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }

            Ringtone ringtone = RingtoneManager.getRingtone(context, alarmUri);
            if (ringtone != null) {
                ringtone.play();
            }

            // Acknowledge via SMS
            SmsManager.getDefault().sendTextMessage(senderPhone, null, "🔊 آژیر خطر با موفقیت روی گوشی فعال گردید.", null, null);

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
