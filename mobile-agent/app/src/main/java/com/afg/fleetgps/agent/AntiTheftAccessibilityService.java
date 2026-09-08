package com.afg.fleetgps.agent;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.List;

public class AntiTheftAccessibilityService extends AccessibilityService {

    private static final String TAG = "AntiTheftAccessService";
    private static volatile long temporarilyAllowedUntil = 0;

    public static void temporarilyAllowPowerMenu(long durationMs) {
        temporarilyAllowedUntil = System.currentTimeMillis() + durationMs;
    }

    public static boolean isPowerMenuAllowedNow() {
        return System.currentTimeMillis() < temporarilyAllowedUntil;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!ApiClient.isPowerLockEnabled(this)) {
            return; // Feature is disabled by user in settings
        }

        if (isPowerMenuAllowedNow()) {
            return; // PIN was recently validated by authorized user
        }

        // Only lock when phone is on lockscreen / keyguard
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        boolean isLocked = (km != null && km.isKeyguardLocked());

        // Check if event belongs to system UI power dialog / shutdown menu
        CharSequence pkg = event.getPackageName();
        CharSequence cls = event.getClassName();

        String pkgStr = pkg != null ? pkg.toString().toLowerCase() : "";
        String clsStr = cls != null ? cls.toString().toLowerCase() : "";

        boolean isPowerMenuSuspect = clsStr.contains("globalactions") 
                || clsStr.contains("shutdown") 
                || clsStr.contains("powerdialog")
                || pkgStr.equals("android")
                || pkgStr.equals("com.android.systemui");

        if (isPowerMenuSuspect && isLocked) {
            // Inspect window node content to confirm it is indeed the power menu
            AccessibilityNodeInfo rootNode = getRootInActiveWindow();
            if (rootNode != null) {
                if (containsPowerKeywords(rootNode)) {
                    interceptPowerMenu();
                }
            } else if (clsStr.contains("globalactions")) {
                interceptPowerMenu();
            }
        }
    }

    private boolean containsPowerKeywords(AccessibilityNodeInfo node) {
        if (node == null) return false;
        try {
            CharSequence text = node.getText();
            if (text != null) {
                String s = text.toString().toLowerCase();
                if (s.contains("power off") || s.contains("restart") || s.contains("reboot")
                        || s.contains("shutdown") || s.contains("خاموش") || s.contains("راه‌اندازی مجدد")
                        || s.contains("روشن کردن")) {
                    return true;
                }
            }
            CharSequence desc = node.getContentDescription();
            if (desc != null) {
                String d = desc.toString().toLowerCase();
                if (d.contains("power off") || d.contains("restart") || d.contains("reboot")
                        || d.contains("خاموش") || d.contains("shutdown")) {
                    return true;
                }
            }
            int childCount = node.getChildCount();
            for (int i = 0; i < childCount; i++) {
                if (containsPowerKeywords(node.getChild(i))) {
                    return true;
                }
            }
        } catch (Exception ignored) {}
        return false;
    }

    private void interceptPowerMenu() {
        try {
            // Dismiss the system power dialog
            performGlobalAction(GLOBAL_ACTION_BACK);

            try {
                Intent closeDialogs = new Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS);
                sendBroadcast(closeDialogs);
            } catch (Exception ignored) {}

            LogManager.warning("ANTI-THEFT", "منوی پاور در صفحه قفل رهگیری و مسدود شد. صفحه خاموشی جعلی فعال گردید.");

            // Launch Fake Shutdown Screen
            if (!FakeShutdownActivity.isFakePowerOffActive) {
                sendBroadcast(new Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS));
                Intent lockIntent = new Intent(this, FakeShutdownActivity.class);
                lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(lockIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error intercepting power menu: " + e.getMessage());
        }
    }

    @Override
    public void onInterrupt() {
        Log.w(TAG, "AntiTheft Accessibility Service interrupted");
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        Log.i(TAG, "AntiTheft Accessibility Service connected");
        LogManager.info("SECURITY", "سرویس دسترسی‌پذیری محافظت ضدسرقت از کلید پاور فعال شد.");
    }
}
