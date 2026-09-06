package com.afg.fleetgps.agent;

import android.annotation.SuppressLint;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import android.telephony.SmsManager;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import android.util.Log;

import java.util.List;

public class SimChangeReceiver extends BroadcastReceiver {
    private static final String TAG = "SimChangeReceiver";

    @SuppressLint({"HardwareIds", "MissingPermission"})
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if ("android.intent.action.SIM_STATE_CHANGED".equals(action)) {
            Log.d(TAG, "SIM state changed detected.");

            String registeredIccid = ApiClient.getRegisteredIccid(context);
            if (registeredIccid == null || registeredIccid.isEmpty()) {
                // No original SIM baseline configured yet
                return;
            }

            List<String> currentIccids = getAllCurrentSimIccids(context);
            for (String currentIccid : currentIccids) {
                if (currentIccid != null && !currentIccid.isEmpty()) {
                    boolean authorized = ApiClient.isSimAuthorized(context, currentIccid);
                    if (!authorized) {
                        Log.w(TAG, "ALERT! Unauthorized SIM Card detected: " + currentIccid);

                        String emergencyPhone = ApiClient.getEmergencyPhone(context);
                        if (emergencyPhone != null && !emergencyPhone.isEmpty()) {
                            triggerStolenSimAlert(context, emergencyPhone, currentIccid);
                            break; // Alert dispatched
                        }
                    }
                }
            }
        }
    }

    @SuppressLint({"HardwareIds", "MissingPermission"})
    private List<String> getAllCurrentSimIccids(Context context) {
        List<String> iccids = new java.util.ArrayList<>();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                SubscriptionManager sm = (SubscriptionManager) context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
                if (sm != null) {
                    List<SubscriptionInfo> subs = sm.getActiveSubscriptionInfoList();
                    if (subs != null && !subs.isEmpty()) {
                        for (SubscriptionInfo sub : subs) {
                            if (sub != null && sub.getIccId() != null && !sub.getIccId().isEmpty()) {
                                iccids.add(sub.getIccId());
                            }
                        }
                    }
                }
            }

            if (iccids.isEmpty()) {
                TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
                if (tm != null && tm.getSimSerialNumber() != null) {
                    iccids.add(tm.getSimSerialNumber());
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to read SIM serial: " + e.getMessage());
        }
        return iccids;
    }

    private void triggerStolenSimAlert(Context context, String targetEmergencyPhone, String newIccid) {
        TrackingService.HarvestedLocation harvested = TrackingService.lastHarvestedLocation;
        Location loc = harvested != null ? harvested.location : TrackingService.lastKnownLocation;
        double lat = loc != null ? loc.getLatitude() : 0.0;
        double lng = loc != null ? loc.getLongitude() : 0.0;
        String source = harvested != null ? harvested.source : (loc != null && loc.getProvider() != null ? loc.getProvider() : "موتور استخراج");
        String age = harvested != null ? ApiClient.formatLocationAge(harvested.timestamp) : "زنده";

        StringBuilder msg = new StringBuilder();
        msg.append("🚨 هشدار سرقت گوشی!\n");
        msg.append("سیمکارت جدید داخل گوشی شما قرار گرفت.\n");
        msg.append("سریال سیمکارت سارق: ").append(newIccid).append("\n");
        if (lat != 0.0 && lng != 0.0) {
            msg.append("📍 موقعیت استخراج‌شده:\n");
            msg.append("https://maps.google.com/?q=").append(lat).append(",").append(lng).append("\n");
            msg.append("منبع داده: ").append(source).append("\n");
            msg.append("زمان ثبت: ").append(age);
        } else {
            msg.append("در حال دریافت و استخراج موقعیت از موتور...");
        }

        // Send SMS via thief's new SIM card to the owner's emergency contact phone
        try {
            SmsManager smsManager = SmsManager.getDefault();
            smsManager.sendTextMessage(targetEmergencyPhone, null, msg.toString(), null, null);
            Log.d(TAG, "Emergency SMS dispatched to: " + targetEmergencyPhone);
            LogManager.warning("SECURITY", "پیامک هشدار تعویض سیم‌کارت همراه با مختصات (" + source + ") به شماره " + targetEmergencyPhone + " مخابره شد.");
        } catch (Exception e) {
            Log.e(TAG, "Failed to send emergency SMS: " + e.getMessage());
        }

        // Also report to the central cloud server if internet is available
        new Thread(() -> {
            ApiClient.sendSecurityEvent(context, "sim_changed", newIccid, null, lat, lng);
        }).start();
    }
}
