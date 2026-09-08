package com.afg.fleetgps.agent;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.telephony.SmsManager;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.UUID;

public class SmsRetryManager {
    private static final String TAG = "SmsRetryManager";
    private static final String PREF_NAME = "SmsRetryQueue";
    private static final String KEY_QUEUE = "queue_v2";
    public static final String ACTION_SMS_SENT = "com.afg.fleetgps.SMS_SENT";

    public static void sendOrEnqueueSms(Context context, String phone, String text) {
        if (phone == null || phone.trim().isEmpty() || text == null) return;
        String msgId = UUID.randomUUID().toString();
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            JSONArray queue = new JSONArray(prefs.getString(KEY_QUEUE, "[]"));
            JSONObject item = new JSONObject();
            item.put("id", msgId);
            item.put("phone", phone);
            item.put("text", text);
            item.put("attempts", 0);
            queue.put(item);
            prefs.edit().putString(KEY_QUEUE, queue.toString()).apply();
            
            LogManager.info("SMS", "پیامک در سیستم ارسال گارانتی‌دار ثبت شد. آماده شلیک به: " + phone);
            processQueue(context);
        } catch (Exception e) {
            Log.e(TAG, "Queue error: " + e.getMessage());
        }
    }

    public static void processQueue(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String qStr = prefs.getString(KEY_QUEUE, "[]");
            JSONArray queue = new JSONArray(qStr);
            if (queue.length() == 0) return;

            JSONArray newQueue = new JSONArray();
            boolean changes = false;

            for (int i = 0; i < queue.length(); i++) {
                JSONObject item = queue.getJSONObject(i);
                String id = item.getString("id");
                String phone = item.getString("phone");
                String text = item.getString("text");
                int attempts = item.optInt("attempts", 0);

                if (attempts < 12) { // 12 attempts over time (e.g. 1 hour total if 5 min intervals)
                    attemptSendNow(context, phone, text, id);
                    item.put("attempts", attempts + 1);
                    newQueue.put(item);
                    changes = true;
                } else {
                    LogManager.warning("SMS", "حذف پیامک از صف به دلیل عدم وجود آنتن/شارژ پس از ۱۲ بار تلاش. شماره: " + phone);
                    changes = true;
                }
            }
            if (changes) {
                prefs.edit().putString(KEY_QUEUE, newQueue.toString()).apply();
            }
        } catch (Exception e) {
            Log.e(TAG, "Process queue error: " + e.getMessage());
        }
    }

    private static void attemptSendNow(Context context, String phone, String text, String id) {
        try {
            SmsManager sms = SmsManager.getDefault();
            Intent sentIntent = new Intent(ACTION_SMS_SENT);
            sentIntent.setPackage(context.getPackageName()); // Explicit for security and Android 11+
            sentIntent.putExtra("msg_id", id);
            sentIntent.putExtra("phone", phone);
            
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            int requestCode = id.hashCode();
            PendingIntent sentPI = PendingIntent.getBroadcast(context, requestCode, sentIntent, flags);

            ArrayList<String> parts = sms.divideMessage(text);
            if (parts.size() > 1) {
                ArrayList<PendingIntent> sentPIs = new ArrayList<>();
                for (int i = 0; i < parts.size(); i++) sentPIs.add(sentPI);
                sms.sendMultipartTextMessage(phone, null, parts, sentPIs, null);
            } else {
                sms.sendTextMessage(phone, null, text, sentPI, null);
            }
        } catch (Exception e) {
            Log.e(TAG, "attemptSendNow error: " + e.getMessage());
        }
    }

    public static void handleSmsSentResult(Context context, Intent intent, int resultCode) {
        String id = intent.getStringExtra("msg_id");
        String phone = intent.getStringExtra("phone");
        if (id == null) return;

        if (resultCode == Activity.RESULT_OK) {
            LogManager.success("SMS", "پیامک با موفقیت به " + phone + " مخابره شد (ارسال قطعی).");
            removeSentMessage(context, id);
        } else {
            String errorName = "خطای ناشناخته";
            switch(resultCode) {
                case SmsManager.RESULT_ERROR_GENERIC_FAILURE: errorName = "خطای شبکه (بدون آنتن/شارژ)"; break;
                case SmsManager.RESULT_ERROR_NO_SERVICE: errorName = "خارج از سرویس‌دهی"; break;
                case SmsManager.RESULT_ERROR_NULL_PDU: errorName = "فرمت نامعتبر"; break;
                case SmsManager.RESULT_ERROR_RADIO_OFF: errorName = "گوشی در حالت پرواز است"; break;
            }
            LogManager.error("SMS", "ارسال پیامک مسدود شد (" + errorName + "). نگهداری در صندوق برای تلاش بعدی...");
        }
    }

    private static void removeSentMessage(Context context, String id) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            JSONArray queue = new JSONArray(prefs.getString(KEY_QUEUE, "[]"));
            JSONArray newQueue = new JSONArray();
            for (int i = 0; i < queue.length(); i++) {
                if (!id.equals(queue.getJSONObject(i).getString("id"))) {
                    newQueue.put(queue.getJSONObject(i));
                }
            }
            prefs.edit().putString(KEY_QUEUE, newQueue.toString()).apply();
        } catch (Exception ignored) {}
    }
}
