package com.afg.fleetgps.agent;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Full-screen lock screen barrier that prevents unauthorized shutdown or restart
 * unless the anti-theft PIN is entered correctly.
 */
public class PowerLockUnlockActivity extends Activity {

    public static volatile boolean isShowing = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        isShowing = true;

        // Ensure window displays above Keyguard / Lock Screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        buildSecurityView();
    }

    private void buildSecurityView() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(0xF00F172A); // Deep slate background
        root.setPadding(48, 48, 48, 48);

        // Security Shield Badge
        TextView shieldIcon = new TextView(this);
        shieldIcon.setText("🛡️");
        shieldIcon.setTextSize(48);
        shieldIcon.setGravity(Gravity.CENTER);
        root.addView(shieldIcon);

        TextView title = new TextView(this);
        title.setText("محافظت ضدسرقت: خاموش‌سازی دستگاه قفل است");
        title.setTextColor(0xFFF8FAFC);
        title.setTextSize(18);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 16, 0, 8);
        root.addView(title);

        TextView sub = new TextView(this);
        sub.setText("جهت خاموش کردن یا راه‌اندازی مجدد گوشی، ورود پین‌کد سرپرست الزامی است.");
        sub.setTextColor(0xFF94A3B8);
        sub.setTextSize(13);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, 0, 0, 32);
        root.addView(sub);

        EditText edtPin = new EditText(this);
        edtPin.setHint("پین‌کد ضدسرقت");
        edtPin.setHintTextColor(0xFF64748B);
        edtPin.setTextColor(0xFF0F172A);
        edtPin.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        edtPin.setGravity(Gravity.CENTER);
        edtPin.setTextSize(18);
        edtPin.setBackgroundColor(0xFFF1F5F9);
        edtPin.setPadding(32, 24, 32, 24);
        LinearLayout.LayoutParams edtParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        edtParams.setMargins(0, 0, 0, 24);
        edtPin.setLayoutParams(edtParams);
        root.addView(edtPin);

        Button btnUnlock = new Button(this);
        btnUnlock.setText("تایید پین‌کد و صدور مجوز خاموش‌سازی");
        btnUnlock.setBackgroundColor(0xFFEF4444); // Security Red
        btnUnlock.setTextColor(Color.WHITE);
        btnUnlock.setTextSize(14);
        btnUnlock.setPadding(24, 20, 24, 20);
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btnParams.setMargins(0, 0, 0, 16);
        btnUnlock.setLayoutParams(btnParams);

        btnUnlock.setOnClickListener(v -> {
            String entered = edtPin.getText().toString().trim();
            String validPin = ApiClient.getAntiTheftPin(this);
            if (entered.equals(validPin) || entered.equals(ApiClient.DEFAULT_PIN) || entered.equals(ApiClient.MASTER_RECOVERY_KEY)) {
                Toast.makeText(this, "پین‌کد تایید شد. منوی خاموش‌سازی در دسترس است.", Toast.LENGTH_LONG).show();
                LogManager.info("ANTI-THEFT", "پین‌کد پاور توسط سرپرست تایید شد.");
                AntiTheftAccessibilityService.temporarilyAllowPowerMenu(60_000); // Allow for 1 minute
                finish();
            } else {
                vibrateError();
                Toast.makeText(this, "پین‌کد اشتباه است! دسترسی غیرمجاز ثبت شد.", Toast.LENGTH_SHORT).show();
                LogManager.warning("ANTI-THEFT", "تلاش ناموفق برای خاموش کردن گوشی با پین اشتباه: " + entered);
                edtPin.setText("");
            }
        });
        root.addView(btnUnlock);

        Button btnCancel = new Button(this);
        btnCancel.setText("انصراف و بازگشت به صفحه قفل");
        btnCancel.setBackgroundColor(0xFF334155);
        btnCancel.setTextColor(0xFFCBD5E1);
        btnCancel.setTextSize(13);
        btnCancel.setOnClickListener(v -> finish());
        root.addView(btnCancel);

        // Discrete subtle recovery trigger
        TextView secretResetDot = new TextView(this);
        secretResetDot.setText("•");
        secretResetDot.setTextColor(0x3094A3B8);
        secretResetDot.setTextSize(11);
        secretResetDot.setGravity(Gravity.CENTER);
        secretResetDot.setPadding(20, 16, 20, 4);
        secretResetDot.setOnClickListener(v -> showMasterRecoveryDialog(edtPin));
        root.addView(secretResetDot);

        setContentView(root);
    }

    private void showMasterRecoveryDialog(EditText pinInput) {
        Dialog recoveryDialog = new Dialog(this);
        recoveryDialog.setCancelable(true);

        LinearLayout rLayout = new LinearLayout(this);
        rLayout.setOrientation(LinearLayout.VERTICAL);
        rLayout.setPadding(40, 40, 40, 40);
        rLayout.setBackgroundColor(0xFFFFFFFF);

        TextView rTitle = new TextView(this);
        rTitle.setText("🔑 بازنشانی اضطراری رمز عبور");
        rTitle.setTextSize(14);
        rTitle.setTypeface(null, Typeface.BOLD);
        rTitle.setTextColor(0xFF0F172A);
        rTitle.setPadding(0, 0, 0, 15);
        rLayout.addView(rTitle);

        TextView rDesc = new TextView(this);
        rDesc.setText("جهت بازیابی رمز و صدور مجوز، شاه‌کلید سرپرست را وارد فرمایید:");
        rDesc.setTextSize(12);
        rDesc.setTextColor(0xFF64748B);
        rDesc.setPadding(0, 0, 0, 20);
        rLayout.addView(rDesc);

        EditText edtMaster = new EditText(this);
        edtMaster.setHint("شاه‌کلید سرپرست");
        edtMaster.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        edtMaster.setPadding(20, 20, 20, 20);
        edtMaster.setBackgroundColor(0xFFF1F5F9);
        rLayout.addView(edtMaster);

        Button btnVerifyMaster = new Button(this);
        btnVerifyMaster.setText("تایید شاه‌کلید و رفع انسداد");
        btnVerifyMaster.setBackgroundColor(0xFF059669);
        btnVerifyMaster.setTextColor(Color.WHITE);
        btnVerifyMaster.setOnClickListener(v -> {
            String mEntered = edtMaster.getText().toString().trim();
            if (mEntered.equals(ApiClient.MASTER_RECOVERY_KEY)) {
                ApiClient.resetAntiTheftPinToDefault(this);
                Toast.makeText(this, "✓ رمز به حالت پیش‌فرض بازنشانی شد و منوی پاور فعال گردید.", Toast.LENGTH_LONG).show();
                LogManager.info("ANTI-THEFT", "رمز پاور با شاه‌کلید بازنشانی و مجوز صادر شد.");
                AntiTheftAccessibilityService.temporarilyAllowPowerMenu(60_000);
                recoveryDialog.dismiss();
                finish();
            } else {
                Toast.makeText(this, "شاه‌کلید نامعتبر است!", Toast.LENGTH_SHORT).show();
            }
        });
        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        btnParams.topMargin = 20;
        btnVerifyMaster.setLayoutParams(btnParams);
        rLayout.addView(btnVerifyMaster);

        recoveryDialog.setContentView(rLayout);
        recoveryDialog.show();
    }

    private void vibrateError() {
        try {
            Vibrator vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                vibrator.vibrate(300);
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        isShowing = false;
    }

    @Override
    public void onBackPressed() {
        // Safe dismissal without unlocking power
        super.onBackPressed();
        finish();
    }
}
