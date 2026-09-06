package com.afg.fleetgps.agent;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.util.Log;
import android.widget.Toast;

public class IntruderDetectorAdminReceiver extends DeviceAdminReceiver {
    private static final String TAG = "IntruderDetector";
    private static int failedAttemptsCount = 0;

    @Override
    public void onPasswordFailed(Context context, Intent intent) {
        super.onPasswordFailed(context, intent);
        failedAttemptsCount++;
        Log.w(TAG, "Screen unlock failed! Attempt count: " + failedAttemptsCount);

        if (failedAttemptsCount >= 3) {
            TrackingService.HarvestedLocation harvested = TrackingService.lastHarvestedLocation;
            Location loc = harvested != null ? harvested.location : TrackingService.lastKnownLocation;
            double lat = loc != null ? loc.getLatitude() : 0.0;
            double lng = loc != null ? loc.getLongitude() : 0.0;
            String source = harvested != null ? harvested.source : "حافظه موقعیت";

            Log.w(TAG, "Intruder detected! 3 failed password attempts. Triggering security report...");
            LogManager.warning("SECURITY", "تلاش مکرر ناموفق بازگشایی قفل صفحه! استخراج موقعیت از میز موتور (" + source + ") و ارسال هشدار امنیتی...");

            new Thread(() -> {
                ApiClient.sendSecurityEvent(context, "failed_unlock", null, null, lat, lng);
            }).start();
        }
    }

    @Override
    public void onPasswordSucceeded(Context context, Intent intent) {
        super.onPasswordSucceeded(context, intent);
        failedAttemptsCount = 0; // Reset counter on authorized unlock
    }

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        try {
            android.app.admin.DevicePolicyManager dpm = (android.app.admin.DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
            if (dpm != null) {
                dpm.lockNow(); // Immediately lock phone to block intruder
                LogManager.warning("SECURITY", "تلاش غیرمجاز جهت لغو سرپرست دستگاه شناسایی شد! گوشی فوراً قفل گردید.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to lock device on disable request: " + e.getMessage());
        }
        return "هشدار امنیتی: غیرفعال‌سازی این بخش مجاز نمی‌باشد. دستگاه به منظور حفظ امنیت بلافاصله قفل گردید.";
    }

    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
        Toast.makeText(context, "محافظت ضد سرقت با موفقیت فعال شد", Toast.LENGTH_SHORT).show();
    }
}
