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
            Location loc = TrackingService.lastKnownLocation;
            double lat = loc != null ? loc.getLatitude() : 0.0;
            double lng = loc != null ? loc.getLongitude() : 0.0;

            Log.w(TAG, "Intruder detected! 3 failed password attempts. Triggering security report...");

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
        return "هشدار: غیرفعال‌سازی دسترسی امنیتی ممکن است قابلیت‌های ردیابی ضد سرقت را مختل سازد.";
    }

    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
        Toast.makeText(context, "محافظت ضد سرقت با موفقیت فعال شد", Toast.LENGTH_SHORT).show();
    }
}
