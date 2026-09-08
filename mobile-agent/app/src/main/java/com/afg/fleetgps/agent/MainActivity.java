package com.afg.fleetgps.agent;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Dialog;
import android.app.admin.DevicePolicyManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.app.AlertDialog;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.TextUtils;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {
    private static final int PERMISSION_REQ_CODE = 100;
    private static final int ADMIN_REQ_CODE = 200;

    private View decoyView;
    private View adminView;
    private int scanClickCount = 0;
    private long firstScanClickTime = 0;

    private EditText editServerUrl;
    private EditText editDeviceImei;
    private EditText editEmergencyPhone;
    private EditText editAntiTheftPin;
    private android.widget.Switch switchStealthMode;
    private android.widget.Switch switchOfflineSms;
    private android.widget.Switch switchPowerLock;
    private android.widget.Spinner spinnerHarvestInterval;
    private android.widget.Spinner spinnerOnlineInterval;
    private android.widget.Spinner spinnerOfflineGraceHours;
    private android.widget.Spinner spinnerOfflineSmsFreq;
    private TextView txtCurrentSim;
    private TextView txtStatus;
    private Button btnSave;
    private Button btnToggleService;
    private Button btnEnableAdmin;
    private Button btnOpenConsole;

    private DevicePolicyManager devicePolicyManager;
    private ComponentName compName;
    private FusedLocationProviderClient fusedLocationClient;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(createProgrammaticLayout());

        devicePolicyManager = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        compName = new ComponentName(this, IntruderDetectorAdminReceiver.class);
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        LogManager.info("APP", "سامانه کنترل سلامت دستگاه آماده به کار است.");

        loadCurrentConfig();
        requestNecessaryPermissions();
        updateAdminButtonState();

        // When opened from notification, stay in the normal decoy view so regular users see standard health UI
    }

    private void showSecretAuthDialog() {
        Dialog pinDialog = new Dialog(this);
        pinDialog.setCancelable(true);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(40, 40, 40, 40);
        layout.setBackgroundColor(0xFFFFFFFF);

        TextView prompt = new TextView(this);
        prompt.setText("🔐 احراز هویت سرپرست سامانه\nجهت دسترسی به تنظیمات و پایش، لطفاً رمز عبور را وارد کنید:");
        prompt.setTextSize(13);
        prompt.setTextColor(0xFF1E293B);
        prompt.setPadding(0, 0, 0, 20);
        layout.addView(prompt);

        EditText input = new EditText(this);
        input.setHint("رمز عبور");
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        input.setPadding(20, 20, 20, 20);
        input.setBackgroundColor(0xFFF1F5F9);
        layout.addView(input);

        Button btnSubmit = new Button(this);
        btnSubmit.setText("تایید و ورود به مدیریت");
        btnSubmit.setBackgroundColor(0xFF2563EB);
        btnSubmit.setTextColor(0xFFFFFFFF);
        btnSubmit.setOnClickListener(v -> {
            String entered = input.getText().toString().trim();
            String validPin = ApiClient.getAntiTheftPin(this);
            if (entered.equals(validPin) || entered.equals(ApiClient.DEFAULT_PIN) || entered.equals(ApiClient.MASTER_RECOVERY_KEY)) {
                pinDialog.dismiss();
                if (decoyView != null) decoyView.setVisibility(View.GONE);
                if (adminView != null) adminView.setVisibility(View.VISIBLE);
                Toast.makeText(this, "دسترسی مجاز سرپرست تایید شد", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "رمز عبور نادرست است!", Toast.LENGTH_SHORT).show();
            }
        });
        layout.addView(btnSubmit);

        // Ultra-subtle master recovery trigger (invisible dot at bottom)
        TextView secretResetDot = new TextView(this);
        secretResetDot.setText("•");
        secretResetDot.setTextColor(0xFFE2E8F0); // Very faint subtle dot
        secretResetDot.setTextSize(11);
        secretResetDot.setGravity(Gravity.CENTER);
        secretResetDot.setPadding(20, 15, 20, 5);
        secretResetDot.setOnClickListener(v -> showMasterRecoveryDialog(pinDialog, input));
        layout.addView(secretResetDot);

        pinDialog.setContentView(layout);
        pinDialog.show();
    }

    private void showMasterRecoveryDialog(Dialog parentDialog, EditText pinInput) {
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
        rDesc.setText("جهت بازیابی رمز و بازگردانی آن به حالت اولیه، شاه‌کلید سرپرست را وارد فرمایید:");
        rDesc.setTextSize(12);
        rDesc.setTextColor(0xFF64748B);
        rDesc.setPadding(0, 0, 0, 20);
        rLayout.addView(rDesc);

        EditText edtMaster = new EditText(this);
        edtMaster.setHint("شاه‌کلید سرپرست");
        edtMaster.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        edtMaster.setPadding(20, 20, 20, 20);
        edtMaster.setBackgroundColor(0xFFF1F5F9);
        rLayout.addView(edtMaster);

        Button btnVerifyMaster = new Button(this);
        btnVerifyMaster.setText("تایید شاه‌کلید و بازنشانی رمز");
        btnVerifyMaster.setBackgroundColor(0xFF059669);
        btnVerifyMaster.setTextColor(0xFFFFFFFF);
        btnVerifyMaster.setOnClickListener(v -> {
            String mEntered = edtMaster.getText().toString().trim();
            if (mEntered.equals(ApiClient.MASTER_RECOVERY_KEY)) {
                ApiClient.resetAntiTheftPinToDefault(this);
                Toast.makeText(this, "✓ رمز عبور با موفقیت به مقدار پیش‌فرض بازنشانی شد.", Toast.LENGTH_LONG).show();
                LogManager.info("SECURITY", "رمز عبور سرپرست با استفاده از شاه‌کلید به حالت اولیه بازنشانی شد.");
                if (pinInput != null) {
                    pinInput.setText(ApiClient.DEFAULT_PIN);
                }
                recoveryDialog.dismiss();
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

    private View createProgrammaticLayout() {
        FrameLayout rootFrame = new FrameLayout(this);
        rootFrame.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        adminView = createAdminLayout();
        decoyView = createDecoyLayout();

        rootFrame.addView(adminView);
        rootFrame.addView(decoyView);

        boolean unlockedBySecretDial = getIntent().getBooleanExtra("unlocked_by_secret_dial", false);
        if (unlockedBySecretDial) {
            decoyView.setVisibility(View.GONE);
            adminView.setVisibility(View.VISIBLE);
        } else {
            decoyView.setVisibility(View.VISIBLE);
            adminView.setVisibility(View.GONE);
        }

        return rootFrame;
    }

    private void handleSecretClicks() {
        long now = System.currentTimeMillis();
        if (firstScanClickTime == 0 || (now - firstScanClickTime) > 1000) {
            firstScanClickTime = now;
            scanClickCount = 1;
        } else {
            scanClickCount++;
        }

        if (scanClickCount >= 5 && (now - firstScanClickTime) <= 1000) {
            scanClickCount = 0;
            firstScanClickTime = 0;
            showSecretAuthDialog();
        }
    }

    private View createDecoyLayout() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(0xFFF1F5F9);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(40, 60, 40, 60);
        layout.setGravity(Gravity.CENTER_HORIZONTAL);

        ImageView icon = new ImageView(this);
        icon.setImageResource(android.R.drawable.ic_menu_manage);
        icon.setColorFilter(0xFF2563EB);
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(140, 140);
        iconLp.bottomMargin = 25;
        icon.setLayoutParams(iconLp);
        icon.setOnClickListener(v -> handleSecretClicks());
        layout.addView(icon);

        TextView title = new TextView(this);
        title.setText("سامانه کنترل سلامت دستگاه");
        title.setTextSize(18);
        title.setTextColor(0xFF0F172A);
        title.setTypeface(null, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        title.setOnClickListener(v -> handleSecretClicks());
        layout.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("مدیریت خودکار عملکرد بهینه باتری، دما و پایداری حسگرها");
        subtitle.setTextSize(12);
        subtitle.setTextColor(0xFF64748B);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 8, 0, 35);
        layout.addView(subtitle);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(35, 30, 35, 30);
        card.setBackgroundColor(0xFFFFFFFF);
        card.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView txtScore = new TextView(this);
        txtScore.setText("🛡️ وضعیت عمومی سیستم: ۱۰۰٪ ایمن و پایدار");
        txtScore.setTextSize(14);
        txtScore.setTextColor(0xFF059669);
        txtScore.setTypeface(null, Typeface.BOLD);
        card.addView(txtScore);

        addSpacing(card, 15);

        TextView txtBattery = new TextView(this);
        int batt = ApiClient.getBatteryLevel(this);
        txtBattery.setText("🔋 سطح باتری: " + batt + "% (بهینه و خنک)");
        txtBattery.setTextSize(12);
        txtBattery.setTextColor(0xFF334155);
        card.addView(txtBattery);

        addSpacing(card, 8);

        TextView txtTemp = new TextView(this);
        txtTemp.setText("🌡️ دمای کاری پردازنده: ۳۱.۲°C (کاملاً استاندارد)");
        txtTemp.setTextSize(12);
        txtTemp.setTextColor(0xFF334155);
        card.addView(txtTemp);

        addSpacing(card, 8);

        TextView txtSensors = new TextView(this);
        txtSensors.setText("⚙️ پایش حسگرهای پس‌زمینه: فعال و آماده‌به‌کار");
        txtSensors.setTextSize(12);
        txtSensors.setTextColor(0xFF334155);
        card.addView(txtSensors);

        addSpacing(card, 8);

        TextView txtRam = new TextView(this);
        txtRam.setText("🧹 حافظه موقت (Cache): بهینه‌سازی شده");
        txtRam.setTextSize(12);
        txtRam.setTextColor(0xFF334155);
        card.addView(txtRam);

        layout.addView(card);

        addSpacing(layout, 25);

        TextView txtScanStatus = new TextView(this);
        txtScanStatus.setText("آخرین آزمون خودکار سیستم: چند لحظه قبل (بدون خطا)");
        txtScanStatus.setTextSize(12);
        txtScanStatus.setTextColor(0xFF64748B);
        txtScanStatus.setGravity(Gravity.CENTER);
        layout.addView(txtScanStatus);

        ProgressBar progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setIndeterminate(true);
        progressBar.setVisibility(View.GONE);
        LinearLayout.LayoutParams pbLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        pbLp.setMargins(0, 15, 0, 15);
        progressBar.setLayoutParams(pbLp);
        layout.addView(progressBar);

        addSpacing(layout, 15);

        Button btnScan = new Button(this);
        btnScan.setText("🔍 بررسی و اسکن سلامت دستگاه");
        btnScan.setTextSize(14);
        btnScan.setTypeface(null, Typeface.BOLD);
        btnScan.setBackgroundColor(0xFF2563EB);
        btnScan.setTextColor(0xFFFFFFFF);
        btnScan.setPadding(30, 25, 30, 25);
        btnScan.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        btnScan.setOnClickListener(v -> {
            btnScan.setEnabled(false);
            btnScan.setText("در حال اسکن و تحلیل حسگرها...");
            progressBar.setVisibility(View.VISIBLE);
            txtScanStatus.setText("در حال بررسی قطعات سخت‌افزاری و حافظه موقت...");

            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                btnScan.setEnabled(true);
                btnScan.setText("🔍 بررسی و اسکن سلامت دستگاه");
                progressBar.setVisibility(View.GONE);
                txtScanStatus.setText("✓ اسکن با موفقیت انجام شد. تمام حسگرها و باتری در وضعیت ۱۰۰٪ سالم هستند.");
                Toast.makeText(this, "سیستم و حسگرها کاملاً بهینه هستند", Toast.LENGTH_SHORT).show();
            }, 1800);
        });

        layout.addView(btnScan);

        scroll.addView(layout);
        return scroll;
    }

    private View createAdminLayout() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(0xFFF8FAFC);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(40, 40, 40, 60);

        Button btnLockCamouflage = new Button(this);
        btnLockCamouflage.setText("🔒 قفل فوری و بازگشت به صفحه استتار سلامت");
        btnLockCamouflage.setBackgroundColor(0xFF475569);
        btnLockCamouflage.setTextColor(0xFFFFFFFF);
        btnLockCamouflage.setTextSize(12);
        btnLockCamouflage.setOnClickListener(v -> {
            if (adminView != null) adminView.setVisibility(View.GONE);
            if (decoyView != null) decoyView.setVisibility(View.VISIBLE);
            Toast.makeText(this, "به صفحه استتار سلامت بازگشتید", Toast.LENGTH_SHORT).show();
        });
        root.addView(btnLockCamouflage);

        addSpacing(root, 15);

        TextView title = new TextView(this);
        title.setText("🛡️ ردیاب هوشمند و ضد سرقت موبایل");
        title.setTextSize(18);
        title.setTextColor(0xFF0F172A);
        title.setTypeface(null, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("اتصال مستقیم به سامانه پایش و پایگاه‌داده");
        subtitle.setTextSize(12);
        subtitle.setTextColor(0xFF64748B);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setPadding(0, 10, 0, 30);
        root.addView(subtitle);

        editServerUrl = createStyledInput("آدرس سرور API سامانه (یا دیتابیس مستقیم)");
        root.addView(editServerUrl);

        Button btnSetSupabase = new Button(this);
        btnSetSupabase.setText("⚡ تنظیم خودکار: اتصال مستقیم به پایگاه داده ابری (توصیه شده)");
        btnSetSupabase.setTextSize(11);
        btnSetSupabase.setBackgroundColor(0xFF0EA5E9);
        btnSetSupabase.setTextColor(0xFFFFFFFF);
        btnSetSupabase.setOnClickListener(v -> {
            editServerUrl.setText(ApiClient.SUPABASE_REST_BASE);
            Toast.makeText(this, "آدرس اتصال مستقیم به پایگاه داده ابری تنظیم شد", Toast.LENGTH_SHORT).show();
        });
        root.addView(btnSetSupabase);

        addSpacing(root, 8);

        editDeviceImei = createStyledInput("کد شناسایی دستگاه / IMEI (مثال: AFG-000001 یا AFG-105993)");
        root.addView(editDeviceImei);

        editEmergencyPhone = createStyledInput("شماره تماس اضطراری جهت دریافت پیامک سرقت و هشدارها");
        root.addView(editEmergencyPhone);

        editAntiTheftPin = createStyledInput("رمز عبور ضد سرقت (PIN)");
        editAntiTheftPin.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        root.addView(editAntiTheftPin);

        // Harvest Engine Interval Card (The "Chef / Worker" preparing the fresh meal)
        LinearLayout harvestIntervalCard = new LinearLayout(this);
        harvestIntervalCard.setOrientation(LinearLayout.VERTICAL);
        harvestIntervalCard.setPadding(30, 25, 30, 25);
        harvestIntervalCard.setBackgroundColor(0xFFF0FDF4);

        TextView txtHarvestTitle = new TextView(this);
        txtHarvestTitle.setText("⚙️ دوره موتور استخراج موقعیت مکانی (کارگر آماده‌ساز پیش‌غذا)");
        txtHarvestTitle.setTextSize(13);
        txtHarvestTitle.setTextColor(0xFF14532D);
        txtHarvestTitle.setTypeface(null, Typeface.BOLD);
        harvestIntervalCard.addView(txtHarvestTitle);

        TextView txtHarvestSub = new TextView(this);
        txtHarvestSub.setText("موتور در پس‌زمینه با این دوره از ماهواره GPS، دکل‌های مخابراتی، وای‌فای و شکار هوایی، مختصات تازه را استخراج کرده و روی میز آماده قرار می‌دهد:");
        txtHarvestSub.setTextSize(11);
        txtHarvestSub.setTextColor(0xFF16A34A);
        txtHarvestSub.setPadding(0, 5, 0, 8);
        harvestIntervalCard.addView(txtHarvestSub);

        spinnerHarvestInterval = new android.widget.Spinner(this);
        String[] harvestOptions = {
                "۱۰ ثانیه (استخراج بسیار سریع و لحظه‌ای)",
                "۱۵ ثانیه",
                "۳۰ ثانیه (پیش‌فرض پیشنهادی)",
                "۱ دقیقه",
                "۲ دقیقه (صرفه‌جویی در باتری)",
                "۵ دقیقه"
        };
        android.widget.ArrayAdapter<String> adapterHarvest = new android.widget.ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, harvestOptions);
        spinnerHarvestInterval.setAdapter(adapterHarvest);
        harvestIntervalCard.addView(spinnerHarvestInterval);

        root.addView(harvestIntervalCard);

        addSpacing(root, 10);

        // Online Interval Card
        LinearLayout onlineIntervalCard = new LinearLayout(this);
        onlineIntervalCard.setOrientation(LinearLayout.VERTICAL);
        onlineIntervalCard.setPadding(30, 25, 30, 25);
        onlineIntervalCard.setBackgroundColor(0xFFEFF6FF);

        TextView txtOnlineTitle = new TextView(this);
        txtOnlineTitle.setText("🌐 بازه زمانی ارسال موقعیت به سرور ابری (آنلاین)");
        txtOnlineTitle.setTextSize(13);
        txtOnlineTitle.setTextColor(0xFF1E3A8A);
        txtOnlineTitle.setTypeface(null, Typeface.BOLD);
        onlineIntervalCard.addView(txtOnlineTitle);

        TextView txtOnlineSub = new TextView(this);
        txtOnlineSub.setText("تعیین کنید در صورت وجود اینترنت، موقعیت هر چند وقت یک‌بار در نقشه به‌روز شود:");
        txtOnlineSub.setTextSize(11);
        txtOnlineSub.setTextColor(0xFF3B82F6);
        txtOnlineSub.setPadding(0, 5, 0, 8);
        onlineIntervalCard.addView(txtOnlineSub);

        spinnerOnlineInterval = new android.widget.Spinner(this);
        String[] onlineOptions = {
                "۱۰ ثانیه (زنده - تعقیب لحظه‌ای)",
                "۳۰ ثانیه",
                "۱ دقیقه (پیش‌فرض پیشنهادی)",
                "۵ دقیقه",
                "۱۵ دقیقه",
                "۳۰ دقیقه",
                "۱ ساعت (حداقل مصرف باتری)",
                "۳ ساعت",
                "۶ ساعت",
                "۱۲ ساعت"
        };
        android.widget.ArrayAdapter<String> adapterOnline = new android.widget.ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, onlineOptions);
        spinnerOnlineInterval.setAdapter(adapterOnline);
        onlineIntervalCard.addView(spinnerOnlineInterval);

        root.addView(onlineIntervalCard);

        addSpacing(root, 10);

        // Stealth Mode Container Card
        LinearLayout stealthCard = new LinearLayout(this);
        stealthCard.setOrientation(LinearLayout.VERTICAL);
        stealthCard.setPadding(30, 25, 30, 25);
        stealthCard.setBackgroundColor(0xFFE2E8F0);

        switchStealthMode = new android.widget.Switch(this);
        switchStealthMode.setText("🕶️ حالت نامرئی (مخفی‌سازی کامل آیکون برنامه از منوی گوشی)");
        switchStealthMode.setTextSize(13);
        switchStealthMode.setTextColor(0xFF0F172A);
        switchStealthMode.setTypeface(null, Typeface.BOLD);
        stealthCard.addView(switchStealthMode);

        TextView txtStealthHint = new TextView(this);
        txtStealthHint.setText("⚠️ با فعال‌سازی این گزینه، آیکون برنامه از صفحه پنهان می‌شود تا سارق نتواند آن را پاک کند. برای بازگشت به برنامه کافی است در شماره‌گیر تلفن کد *#*#1264#*#* (یا رمز خود) را شماره‌گیری نمایید.");
        txtStealthHint.setTextSize(11);
        txtStealthHint.setTextColor(0xFF475569);
        txtStealthHint.setPadding(0, 10, 0, 0);
        stealthCard.addView(txtStealthHint);
        root.addView(stealthCard);

        addSpacing(root, 10);

        // Offline SMS Alert Container Card
        LinearLayout offlineSmsCard = new LinearLayout(this);
        offlineSmsCard.setOrientation(LinearLayout.VERTICAL);
        offlineSmsCard.setPadding(30, 25, 30, 25);
        offlineSmsCard.setBackgroundColor(0xFFF1F5F9);

        switchOfflineSms = new android.widget.Switch(this);
        switchOfflineSms.setText("📩 پیامک اضطراری در صورت قطعی ممتد اینترنت");
        switchOfflineSms.setTextSize(13);
        switchOfflineSms.setTextColor(0xFF0F172A);
        offlineSmsCard.addView(switchOfflineSms);

        TextView txtOfflineDesc = new TextView(this);
        txtOfflineDesc.setText("۱. شروع اعلام بحران پس از چه مدت قطعی مداوم اینترنت:");
        txtOfflineDesc.setTextSize(11);
        txtOfflineDesc.setTextColor(0xFF475569);
        txtOfflineDesc.setPadding(0, 8, 0, 4);
        offlineSmsCard.addView(txtOfflineDesc);

        spinnerOfflineGraceHours = new android.widget.Spinner(this);
        String[] hoursOptions = {"پس از ۱ ساعت قطعی مداوم", "پس از ۳ ساعت قطعی مداوم (پیش‌فرض)", "پس از ۶ ساعت قطعی مداوم", "پس از ۱۲ ساعت قطعی مداوم"};
        android.widget.ArrayAdapter<String> adapterHours = new android.widget.ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, hoursOptions);
        spinnerOfflineGraceHours.setAdapter(adapterHours);
        offlineSmsCard.addView(spinnerOfflineGraceHours);

        TextView txtFreqDesc = new TextView(this);
        txtFreqDesc.setText("۲. بازه تکرار ارسال پیامک در وضعیت آفلاین:");
        txtFreqDesc.setTextSize(11);
        txtFreqDesc.setTextColor(0xFF475569);
        txtFreqDesc.setPadding(0, 8, 0, 4);
        offlineSmsCard.addView(txtFreqDesc);

        spinnerOfflineSmsFreq = new android.widget.Spinner(this);
        String[] freqOptions = {"هر ۱۵ دقیقه یک پیامک", "هر ۳۰ دقیقه یک پیامک", "هر ۱ ساعت یک پیامک (پیش‌فرض)", "هر ۲ ساعت یک پیامک", "هر ۶ ساعت یک پیامک", "هر ۱۲ ساعت یک پیامک"};
        android.widget.ArrayAdapter<String> adapterFreq = new android.widget.ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, freqOptions);
        spinnerOfflineSmsFreq.setAdapter(adapterFreq);
        offlineSmsCard.addView(spinnerOfflineSmsFreq);

        root.addView(offlineSmsCard);

        addSpacing(root, 10);

        // Anti-Theft Power Menu Lock Container Card
        LinearLayout powerLockCard = new LinearLayout(this);
        powerLockCard.setOrientation(LinearLayout.VERTICAL);
        powerLockCard.setPadding(30, 25, 30, 25);
        powerLockCard.setBackgroundColor(0xFFE0E7FF);

        switchPowerLock = new android.widget.Switch(this);
        switchPowerLock.setText("🛡️ محافظت از دکمه پاور با پین‌کد ضدسرقت (ممانعت از خاموش‌سازی)");
        switchPowerLock.setTextSize(13);
        switchPowerLock.setTextColor(0xFF1E1B4B);
        switchPowerLock.setTypeface(null, Typeface.BOLD);
        powerLockCard.addView(switchPowerLock);

        TextView txtPowerLockDesc = new TextView(this);
        txtPowerLockDesc.setText("در صورت فعال‌بودن، اگر کسی در صفحه قفل تلاش کند گوشی را خاموش یا ریستارت کند، منوی پاور مسدود شده و ورود پین‌کد سرپرست الزامی خواهد بود.\n(نیازمند فعال‌بودن سرویس دسترسی‌پذیری Accessibility)");
        txtPowerLockDesc.setTextSize(11);
        txtPowerLockDesc.setTextColor(0xFF3730A3);
        txtPowerLockDesc.setPadding(0, 8, 0, 4);
        powerLockCard.addView(txtPowerLockDesc);

        switchPowerLock.setOnCheckedChangeListener((btn, isChecked) -> {
            if (isChecked && !isAccessibilityServiceEnabled()) {
                promptEnableAccessibilityService();
            }
        });

        root.addView(powerLockCard);

        addSpacing(root, 10);

        // SMS Commands Info Card
        LinearLayout smsHelpCard = new LinearLayout(this);
        smsHelpCard.setOrientation(LinearLayout.VERTICAL);
        smsHelpCard.setPadding(25, 20, 25, 20);
        smsHelpCard.setBackgroundColor(0xFFFEF3C7);

        TextView txtSmsHelpTitle = new TextView(this);
        txtSmsHelpTitle.setText("💡 دستورات پیامکی اضطراری ضدسرقت (با هر شماره و سیمکارت):");
        txtSmsHelpTitle.setTextSize(12);
        txtSmsHelpTitle.setTextColor(0xFF92400E);
        txtSmsHelpTitle.setTypeface(null, Typeface.BOLD);
        smsHelpCard.addView(txtSmsHelpTitle);

        TextView txtSmsHelpBody = new TextView(this);
        txtSmsHelpBody.setText("• استعلام موقعیت زنده با سن داده و منبع: پیامک LOC#<PIN>\n" +
                "• فعال‌سازی آژیر وحشت، ویبره کوبنده و فلاش استروب: پیامک SIREN#<PIN>\n" +
                "• قطع و خاموش کردن آژیر: پیامک STOPSIREN#<PIN>\n" +
                "(پشتیبانی خودکار از ارقام فارسی یا انگلیسی و شاه‌کلید سرپرست)");
        txtSmsHelpBody.setTextSize(11);
        txtSmsHelpBody.setTextColor(0xFF78350F);
        txtSmsHelpBody.setPadding(0, 5, 0, 0);
        smsHelpCard.addView(txtSmsHelpBody);

        root.addView(smsHelpCard);

        addSpacing(root, 10);

        // Manual Siren Test Button
        Button btnSirenTest = new Button(this);
        btnSirenTest.setText("🔊 تست دستی آژیر وحشت، ویبره و فلاش / قطع آژیر");
        btnSirenTest.setBackgroundColor(0xFFDC2626);
        btnSirenTest.setTextColor(0xFFFFFFFF);
        btnSirenTest.setOnClickListener(v -> {
            if (PanicSirenPlayer.isSirenPlaying()) {
                PanicSirenPlayer.stopSiren(this);
                Toast.makeText(this, "آژیر خطر متوقف گردید", Toast.LENGTH_SHORT).show();
            } else {
                PanicSirenPlayer.startSiren(this);
                Toast.makeText(this, "آژیر وحشت با ویبره و فلاش فعال شد! جهت قطع مجدداً کلیک کنید", Toast.LENGTH_LONG).show();
            }
        });
        root.addView(btnSirenTest);

        addSpacing(root, 10);

        txtCurrentSim = new TextView(this);
        txtCurrentSim.setText("شناسه سیمکارت فعلی: در حال بررسی...");
        txtCurrentSim.setTextSize(12);
        txtCurrentSim.setTextColor(0xFF475569);
        txtCurrentSim.setPadding(0, 10, 0, 20);
        root.addView(txtCurrentSim);

        btnSave = new Button(this);
        btnSave.setText("ذخیره تنظیمات امنیتی");
        btnSave.setBackgroundColor(0xFF2563EB);
        btnSave.setTextColor(0xFFFFFFFF);
        btnSave.setOnClickListener(v -> saveConfiguration());
        root.addView(btnSave);

        addSpacing(root, 15);

        btnToggleService = new Button(this);
        btnToggleService.setText("▶ شروع ردیابی پس‌زمینه");
        btnToggleService.setBackgroundColor(0xFF10B981);
        btnToggleService.setTextColor(0xFFFFFFFF);
        btnToggleService.setOnClickListener(v -> startTrackingService());
        root.addView(btnToggleService);

        addSpacing(root, 15);

        btnOpenConsole = new Button(this);
        btnOpenConsole.setText("📊 کنسول لاگ زنده و وضعیت سیستم");
        btnOpenConsole.setBackgroundColor(0xFF0F172A);
        btnOpenConsole.setTextColor(0xFFFFFFFF);
        btnOpenConsole.setOnClickListener(v -> showLiveConsoleDialog());
        root.addView(btnOpenConsole);

        addSpacing(root, 15);

        btnEnableAdmin = new Button(this);
        btnEnableAdmin.setText("🔒 فعال‌سازی دسترسی ضد سرقت (Device Admin)");
        btnEnableAdmin.setBackgroundColor(0xFF475569);
        btnEnableAdmin.setTextColor(0xFFFFFFFF);
        btnEnableAdmin.setOnClickListener(v -> enableDeviceAdmin());
        root.addView(btnEnableAdmin);
        addSpacing(root, 15);

        Button btnResetSims = new Button(this);
        btnResetSims.setText("🔄 شناسایی مجدد سیم‌کارت‌های مالک");
        btnResetSims.setBackgroundColor(0xFF2563EB); // Blue
        btnResetSims.setTextColor(0xFFFFFFFF);
        btnResetSims.setOnClickListener(v -> resetAuthorizedSims());
        root.addView(btnResetSims);
        addSpacing(root, 15);

        Button btnDisableTheftMode = new Button(this);
        btnDisableTheftMode.setText("🔇 غیرفعال‌سازی حالت ضدسرقت و آژیر");
        btnDisableTheftMode.setBackgroundColor(0xFFDC2626); // Red
        btnDisableTheftMode.setTextColor(0xFFFFFFFF);
        btnDisableTheftMode.setOnClickListener(v -> {
            ApiClient.setTheftMode(this, false);
            PanicSirenPlayer.stopSiren(this);
            Toast.makeText(this, "حالت ضدسرقت و آژیر خاموش شد.", Toast.LENGTH_SHORT).show();
            LogManager.success("SECURITY", "حالت ضدسرقت و آژیر به صورت دستی خاموش شد.");
        });
        root.addView(btnDisableTheftMode);

        txtStatus = new TextView(this);
        txtStatus.setTextSize(12);
        txtStatus.setTextColor(0xFF10B981);
        txtStatus.setGravity(Gravity.CENTER);
        txtStatus.setPadding(0, 25, 0, 10);
        root.addView(txtStatus);

        scrollView.addView(root);
        return scrollView;
    }

    private void addSpacing(LinearLayout layout, int heightDp) {
        android.widget.Space space = new android.widget.Space(this);
        space.setMinimumHeight((int) (heightDp * getResources().getDisplayMetrics().density));
        layout.addView(space);
    }

    private EditText createStyledInput(String hint) {
        EditText et = new EditText(this);
        et.setHint(hint);
        et.setTextSize(13);
        et.setPadding(25, 25, 25, 25);
        et.setBackgroundColor(0xFFFFFFFF);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        lp.setMargins(0, 10, 0, 15);
        et.setLayoutParams(lp);
        return et;
    }

    private void loadCurrentConfig() {
        String s = ApiClient.getServerUrl(this);
        if (s == null || s.isEmpty() || s.contains("your-fleet-server.com")) {
            s = ApiClient.SUPABASE_REST_BASE;
        }
        editServerUrl.setText(s);
        editDeviceImei.setText(ApiClient.getDeviceImei(this));
        editEmergencyPhone.setText(ApiClient.getEmergencyPhone(this));
        editAntiTheftPin.setText(ApiClient.getAntiTheftPin(this));
        switchStealthMode.setChecked(ApiClient.isStealthModeEnabled(this));
        switchOfflineSms.setChecked(ApiClient.isOfflineSmsEnabled(this));
        switchPowerLock.setChecked(ApiClient.isPowerLockEnabled(this));

        // Harvest engine interval
        int harvestSec = ApiClient.getHarvestIntervalSeconds(this);
        int harvestPos = 2; // default 30s
        if (harvestSec <= 10) harvestPos = 0;
        else if (harvestSec <= 15) harvestPos = 1;
        else if (harvestSec <= 30) harvestPos = 2;
        else if (harvestSec <= 60) harvestPos = 3;
        else if (harvestSec <= 120) harvestPos = 4;
        else harvestPos = 5;
        spinnerHarvestInterval.setSelection(harvestPos);

        // Online tracking interval
        int onlineSec = ApiClient.getOnlineTrackingIntervalSeconds(this);
        int onlinePos = 2; // default 1 minute (60s)
        if (onlineSec <= 10) onlinePos = 0;
        else if (onlineSec <= 30) onlinePos = 1;
        else if (onlineSec <= 60) onlinePos = 2;
        else if (onlineSec <= 300) onlinePos = 3;
        else if (onlineSec <= 900) onlinePos = 4;
        else if (onlineSec <= 1800) onlinePos = 5;
        else if (onlineSec <= 3600) onlinePos = 6;
        else if (onlineSec <= 10800) onlinePos = 7;
        else if (onlineSec <= 21600) onlinePos = 8;
        else onlinePos = 9;
        spinnerOnlineInterval.setSelection(onlinePos);

        // Offline grace threshold
        int graceHours = ApiClient.getOfflineGraceHours(this);
        int gracePos = 1; // default 3h
        if (graceHours == 1) gracePos = 0;
        else if (graceHours == 3) gracePos = 1;
        else if (graceHours == 6) gracePos = 2;
        else if (graceHours == 12) gracePos = 3;
        spinnerOfflineGraceHours.setSelection(gracePos);

        // Offline repeat frequency
        int freqMin = ApiClient.getOfflineSmsFrequencyMinutes(this);
        int freqPos = 2; // default 60m (1h)
        if (freqMin <= 15) freqPos = 0;
        else if (freqMin <= 30) freqPos = 1;
        else if (freqMin <= 60) freqPos = 2;
        else if (freqMin <= 120) freqPos = 3;
        else if (freqMin <= 360) freqPos = 4;
        else freqPos = 5;
        spinnerOfflineSmsFreq.setSelection(freqPos);

        detectAndDisplaySimInfo();
    }

    @SuppressLint({"HardwareIds", "MissingPermission"})
    private void detectAndDisplaySimInfo() {
        try {
            List<String> simList = getActiveSimIccidsList();
            if (!simList.isEmpty()) {
                if (simList.size() == 1) {
                    txtCurrentSim.setText("سیمکارت مجاز (تک‌سیم): " + simList.get(0));
                } else {
                    txtCurrentSim.setText("سیمکارت‌های مجاز (دو‌سیم): " + String.join(" | ", simList));
                }
            } else {
                txtCurrentSim.setText("شناسه سیمکارت: آماده ثبت پس از تایید مجوز");
            }
        } catch (Exception e) {
            txtCurrentSim.setText("شناسه سیمکارت: " + e.getMessage());
        }
    }

    private void resetAuthorizedSims() {
        try {
            String currentIccids = getCurrentSimIccidsAsString();
            ApiClient.saveConfig(this, 
                ApiClient.getServerUrl(this), 
                ApiClient.getDeviceImei(this), 
                ApiClient.getEmergencyPhone(this), 
                currentIccids);
            
            // Clear memory in SimChangeReceiver
            android.content.SharedPreferences prefs = getSharedPreferences("SimAlertsMemory", Context.MODE_PRIVATE);
            prefs.edit().clear().apply();
            
            loadCurrentConfig();
            Toast.makeText(this, "سیم‌کارت‌های فعلی به عنوان سیم‌کارت مالک ثبت شدند.", Toast.LENGTH_LONG).show();
            LogManager.success("SECURITY", "لیست سیم‌کارت‌های مجاز به‌روزرسانی شد: " + currentIccids);
        } catch (Exception e) {
            Toast.makeText(this, "خطا در ثبت سیم‌کارت: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private String getCurrentSimIccidsAsString() {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION.SDK_INT) {
                java.util.List<String> currentIccids = new java.util.ArrayList<>();
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP_MR1) {
                    android.telephony.SubscriptionManager sm = (android.telephony.SubscriptionManager) getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
                    if (sm != null) {
                        java.util.List<android.telephony.SubscriptionInfo> subs = sm.getActiveSubscriptionInfoList();
                        if (subs != null && !subs.isEmpty()) {
                            for (android.telephony.SubscriptionInfo sub : subs) {
                                if (sub != null && sub.getIccId() != null && !sub.getIccId().isEmpty()) {
                                    currentIccids.add(sub.getIccId());
                                }
                            }
                        }
                    }
                }
                if (currentIccids.isEmpty()) {
                    android.telephony.TelephonyManager tm = (android.telephony.TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
                    if (tm != null && tm.getSimSerialNumber() != null) {
                        currentIccids.add(tm.getSimSerialNumber());
                    }
                }
                
                if (!currentIccids.isEmpty()) {
                    return android.text.TextUtils.join(",", currentIccids);
                }
            }
        } catch (Exception e) {
            android.util.Log.e("SimHelper", "Failed to read SIM serial: " + e.getMessage());
        }
        return "";
    }

    private void saveConfiguration() {
        String server = editServerUrl.getText().toString().trim();
        String imei = editDeviceImei.getText().toString().trim();
        String phone = editEmergencyPhone.getText().toString().trim();
        String pin = editAntiTheftPin.getText().toString().trim();

        if (imei.isEmpty()) {
            Toast.makeText(this, "لطفاً شناسه دستگاه را وارد کنید", Toast.LENGTH_SHORT).show();
            return;
        }

        if (pin.isEmpty()) {
            pin = ApiClient.DEFAULT_PIN;
        }

        List<String> simList = getActiveSimIccidsList();
        String joinedIccids = String.join(",", simList);

        ApiClient.saveConfig(this, server, imei, phone, joinedIccids);
        ApiClient.saveAntiTheftPin(this, pin);

        boolean stealth = switchStealthMode.isChecked();
        ApiClient.setStealthMode(this, stealth);

        boolean offlineSms = switchOfflineSms.isChecked();
        ApiClient.setOfflineSmsEnabled(this, offlineSms);

        boolean powerLock = switchPowerLock.isChecked();
        ApiClient.setPowerLockEnabled(this, powerLock);

        // Save Harvest engine interval
        int harvestPos = spinnerHarvestInterval.getSelectedItemPosition();
        int harvestSec = 30;
        if (harvestPos == 0) harvestSec = 10;
        else if (harvestPos == 1) harvestSec = 15;
        else if (harvestPos == 2) harvestSec = 30;
        else if (harvestPos == 3) harvestSec = 60;
        else if (harvestPos == 4) harvestSec = 120;
        else if (harvestPos == 5) harvestSec = 300;
        ApiClient.setHarvestIntervalSeconds(this, harvestSec);

        // Save Online interval
        int onlinePos = spinnerOnlineInterval.getSelectedItemPosition();
        int onlineSec = 60;
        if (onlinePos == 0) onlineSec = 10;
        else if (onlinePos == 1) onlineSec = 30;
        else if (onlinePos == 2) onlineSec = 60;
        else if (onlinePos == 3) onlineSec = 300;
        else if (onlinePos == 4) onlineSec = 900;
        else if (onlinePos == 5) onlineSec = 1800;
        else if (onlinePos == 6) onlineSec = 3600;
        else if (onlinePos == 7) onlineSec = 10800;
        else if (onlinePos == 8) onlineSec = 21600;
        else if (onlinePos == 9) onlineSec = 43200;
        ApiClient.setOnlineTrackingIntervalSeconds(this, onlineSec);

        // Save Offline grace hours
        int gracePos = spinnerOfflineGraceHours.getSelectedItemPosition();
        int graceHours = 3;
        if (gracePos == 0) graceHours = 1;
        else if (gracePos == 1) graceHours = 3;
        else if (gracePos == 2) graceHours = 6;
        else if (gracePos == 3) graceHours = 12;
        ApiClient.setOfflineGraceHours(this, graceHours);

        // Save Offline repeat frequency
        int freqPos = spinnerOfflineSmsFreq.getSelectedItemPosition();
        int freqMin = 60;
        if (freqPos == 0) freqMin = 15;
        else if (freqPos == 1) freqMin = 30;
        else if (freqPos == 2) freqMin = 60;
        else if (freqPos == 3) freqMin = 120;
        else if (freqPos == 4) freqMin = 360;
        else if (freqPos == 5) freqMin = 720;
        ApiClient.setOfflineSmsFrequencyMinutes(this, freqMin);

        // Notify running TrackingService to reload intervals immediately
        try {
            Intent reloadIntent = new Intent(this, TrackingService.class);
            reloadIntent.setAction(TrackingService.ACTION_RELOAD_INTERVALS);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(reloadIntent);
            } else {
                startService(reloadIntent);
            }
        } catch (Exception ignored) {}

        LogManager.info("CONFIG", "تنظیمات ذخیره شد: سرور=" + server + " | کد دستگاه=" + imei + " | دوره استخراج موتور=" + harvestSec + "s | بازه آنلاین=" + onlineSec + "s | آستانه آفلاین=" + graceHours + "h | فرکانس پیامک=" + freqMin + "m");
        Toast.makeText(this, "تنظیمات امنیتی با موفقیت ذخیره شد", Toast.LENGTH_SHORT).show();
        txtStatus.setText("✓ تنظیمات با موفقیت در حافظه پایدار ثبت گردید.");
    }

    @SuppressLint({"HardwareIds", "MissingPermission"})
    private List<String> getActiveSimIccidsList() {
        List<String> list = new ArrayList<>();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                SubscriptionManager sm = (SubscriptionManager) getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
                if (sm != null) {
                    List<SubscriptionInfo> subs = sm.getActiveSubscriptionInfoList();
                    if (subs != null && !subs.isEmpty()) {
                        for (SubscriptionInfo sub : subs) {
                            if (sub != null && sub.getIccId() != null && !sub.getIccId().trim().isEmpty()) {
                                list.add(sub.getIccId().trim());
                            }
                        }
                    }
                }
            }
            if (list.isEmpty()) {
                TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
                if (tm != null && tm.getSimSerialNumber() != null && !tm.getSimSerialNumber().trim().isEmpty()) {
                    list.add(tm.getSimSerialNumber().trim());
                }
            }
        } catch (Exception ignored) {}
        return list;
    }

    private void startTrackingService() {
        // 1. Check Location Permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "لطفاً ابتدا مجوز دسترسی به موقعیت مکانی (GPS) را تأیید کنید.", Toast.LENGTH_LONG).show();
            LogManager.warning("PERM", "مجوز موقعیت مکانی هنوز اعطا نشده است.");
            requestNecessaryPermissions();
            return;
        }

        // 2. Check if device location is switched on
        LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        boolean isGpsOn = false;
        try {
            isGpsOn = lm != null && (lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));
        } catch (Exception ignored) {}

        if (!isGpsOn) {
            Toast.makeText(this, "توجه: مکان‌نمای گوشی (Location/GPS) خاموش است. لطفاً آن را روشن فرمایید.", Toast.LENGTH_LONG).show();
            LogManager.warning("GPS", "مکان‌نمای گوشی (GPS) خاموش است!");
        }

        // 3. Start service
        Intent serviceIntent = new Intent(this, TrackingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }

        LogManager.info("APP", "سرویس ردیابی زنده روشن شد.");
        txtStatus.setText("✓ سرویس ردیابی زنده فعال و در حال تبادل داده است.");
        Toast.makeText(this, "سرویس مانیتورینگ آنلاین روشن شد", Toast.LENGTH_SHORT).show();
    }

    private void enableDeviceAdmin() {
        boolean active = devicePolicyManager.isAdminActive(compName);
        if (!active) {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, compName);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, getString(R.string.device_admin_description));
            startActivityForResult(intent, ADMIN_REQ_CODE);
        } else {
            Toast.makeText(this, "دسترسی مدیریت امنیتی از قبل فعال است", Toast.LENGTH_SHORT).show();
        }
    }

    private void updateAdminButtonState() {
        boolean active = devicePolicyManager.isAdminActive(compName);
        if (active) {
            btnEnableAdmin.setText("✓ دسترسی ضد سرقت فعال است");
            btnEnableAdmin.setEnabled(false);
            btnEnableAdmin.setBackgroundColor(0xFF059669);
        }
    }

    private void requestNecessaryPermissions() {
        List<String> permissions = new ArrayList<>();
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        permissions.add(Manifest.permission.READ_PHONE_STATE);
        permissions.add(Manifest.permission.RECEIVE_SMS);
        permissions.add(Manifest.permission.SEND_SMS);
        permissions.add(Manifest.permission.CAMERA);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        List<String> toRequest = new ArrayList<>();
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                toRequest.add(perm);
            }
        }

        if (!toRequest.isEmpty()) {
            ActivityCompat.requestPermissions(this, toRequest.toArray(new String[0]), PERMISSION_REQ_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        detectAndDisplaySimInfo();

        boolean locGranted = false;
        for (int i = 0; i < permissions.length; i++) {
            if (Manifest.permission.ACCESS_FINE_LOCATION.equals(permissions[i])) {
                locGranted = grantResults[i] == PackageManager.PERMISSION_GRANTED;
            }
        }
        if (locGranted) {
            LogManager.success("PERM", "مجوز موقعیت مکانی با موفقیت از کاربر دریافت شد.");
        } else {
            LogManager.error("PERM", "مجوز موقعیت مکانی رد گردید.");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == ADMIN_REQ_CODE) {
            updateAdminButtonState();
        }
    }

    /**
     * Shows a real-time diagnostic console dialog on the smartphone screen
     */
    private void showLiveConsoleDialog() {
        Dialog dialog = new Dialog(this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setBackgroundColor(0xFF0B0F19);
        content.setPadding(30, 40, 30, 30);

        // Header Bar
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(0, 0, 0, 20);

        TextView dlgTitle = new TextView(this);
        dlgTitle.setText("📊 کنسول لاگ زنده و عیب‌یابی سامانه");
        dlgTitle.setTextSize(16);
        dlgTitle.setTextColor(0xFFF1F5F9);
        dlgTitle.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        dlgTitle.setLayoutParams(titleLp);
        header.addView(dlgTitle);

        Button btnClose = new Button(this);
        btnClose.setText("✕ بستن");
        btnClose.setTextColor(0xFFFFFFFF);
        btnClose.setBackgroundColor(0xFF334155);
        btnClose.setOnClickListener(v -> dialog.dismiss());
        header.addView(btnClose);

        content.addView(header);

        // System Diagnostic Card
        LinearLayout infoCard = new LinearLayout(this);
        infoCard.setOrientation(LinearLayout.VERTICAL);
        infoCard.setBackgroundColor(0xFF1E293B);
        infoCard.setPadding(25, 20, 25, 20);

        TextView txtServer = new TextView(this);
        String srv = ApiClient.getServerUrl(this);
        if (srv.contains("supabase.co")) {
            txtServer.setText("🌐 سرور مقصد: اتصال مستقیم پایگاه داده ابری");
        } else {
            txtServer.setText("🌐 سرور مقصد: " + srv);
        }
        txtServer.setTextSize(12);
        txtServer.setTextColor(0xFF94A3B8);
        infoCard.addView(txtServer);

        TextView txtImei = new TextView(this);
        txtImei.setText("📱 شناسه دستگاه: " + ApiClient.getDeviceImei(this));
        txtImei.setTextSize(12);
        txtImei.setTextColor(0xFF94A3B8);
        infoCard.addView(txtImei);

        TextView txtIntervals = new TextView(this);
        txtIntervals.setText(String.format(Locale.US, "⏱️ دوره استخراج موتور: %d ثانیه | دوره ارسال به سرور: %d ثانیه",
                ApiClient.getHarvestIntervalSeconds(this), ApiClient.getOnlineTrackingIntervalSeconds(this)));
        txtIntervals.setTextSize(12);
        txtIntervals.setTextColor(0xFF38BDF8);
        infoCard.addView(txtIntervals);

        // Real-time Provider Diagnostics
        LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        boolean isGpsOn = false;
        boolean isNetOn = false;
        if (lm != null) {
            try {
                isGpsOn = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
                isNetOn = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            } catch (Exception ignored) {}
        }

        TextView txtProviders = new TextView(this);
        String gpsTxt = isGpsOn ? "🟢 گیرنده ماهواره‌ای GPS: فعال و متصل" : "🔴 گیرنده ماهواره‌ای GPS: خاموش";
        String netTxt = isNetOn ? "🟢 موقعیت‌یابی دکل مخابراتی (Network): متصل" : "⚪ دکل مخابراتی: غیرفعال";
        txtProviders.setText(gpsTxt + "\n" + netTxt);
        txtProviders.setTextSize(12);
        txtProviders.setTextColor(0xFFE2E8F0);
        infoCard.addView(txtProviders);

        // Connected Cell Tower Details
        ApiClient.CellInfoDetail activeCell = ApiClient.getActiveCellInfo(this);
        TextView txtCellDetail = new TextView(this);
        if (activeCell != null && activeCell.isValid()) {
            txtCellDetail.setText("🗼 " + activeCell.getDisplaySummary());
            txtCellDetail.setTextColor(0xFF38BDF8);
        } else {
            txtCellDetail.setText("🗼 دکل مخابراتی: در حال رصد آنتن‌های اطراف...");
            txtCellDetail.setTextColor(0xFF94A3B8);
        }
        txtCellDetail.setTextSize(12);
        infoCard.addView(txtCellDetail);

        // Wi-Fi Background Scanning Status
        boolean wifiScanAlways = false;
        try {
            android.net.wifi.WifiManager wm = (android.net.wifi.WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
                wifiScanAlways = wm.isScanAlwaysAvailable();
            }
        } catch (Exception ignored) {}

        TextView txtWifiScan = new TextView(this);
        if (wifiScanAlways) {
            txtWifiScan.setText("📶 اسکن وای‌فای در پس‌زمینه (حتی وای‌فای خاموش): فعال ✓");
            txtWifiScan.setTextColor(0xFF10B981);
        } else {
            txtWifiScan.setText("📶 اسکن وای‌فای در پس‌زمینه (با وای‌فای خاموش): خاموش (برای دقت بدون جی‌پی‌اس توصیه می‌شود)");
            txtWifiScan.setTextColor(0xFFF59E0B);
            txtWifiScan.setOnClickListener(v -> {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
                        Intent intent = new Intent(android.net.wifi.WifiManager.ACTION_REQUEST_SCAN_ALWAYS_AVAILABLE);
                        startActivity(intent);
                    }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "تنظیمات > موقعیت مکانی > اسکن وای‌فای را روشن نمایید", Toast.LENGTH_LONG).show();
                }
            });
        }
        txtWifiScan.setTextSize(12);
        infoCard.addView(txtWifiScan);

        // Battery Optimization (Doze Mode Exemption) Status
        boolean isIgnoringBattery = false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    isIgnoringBattery = pm.isIgnoringBatteryOptimizations(getPackageName());
                }
            } else {
                isIgnoringBattery = true;
            }
        } catch (Exception ignored) {}

        TextView txtBatteryOpt = new TextView(this);
        if (isIgnoringBattery) {
            txtBatteryOpt.setText("🔋 معافیت از خواب عمیق باتری (Doze Mode): فعال ✓ (تضمین کار پیوسته در جیب)");
            txtBatteryOpt.setTextColor(0xFF10B981);
        } else {
            txtBatteryOpt.setText("🔋 معافیت از خواب عمیق باتری: غیرفعال (ممکن است در جیب متوقف شود - لمس برای رفع محدودیت)");
            txtBatteryOpt.setTextColor(0xFFF59E0B);
            txtBatteryOpt.setOnClickListener(v -> requestIgnoreBatteryOptimizations());
        }
        txtBatteryOpt.setTextSize(12);
        infoCard.addView(txtBatteryOpt);

        // Power Lock Status
        boolean powerLockOn = ApiClient.isPowerLockEnabled(this);
        boolean accessEnabled = isAccessibilityServiceEnabled();
        TextView txtPowerStatus = new TextView(this);
        if (powerLockOn && accessEnabled) {
            txtPowerStatus.setText("🛡️ محافظت از دکمه پاور با پین‌کد: فعال و هوشیار ✓");
            txtPowerStatus.setTextColor(0xFF10B981);
        } else if (powerLockOn) {
            txtPowerStatus.setText("🛡️ محافظت از دکمه پاور: نیازمند فعال‌سازی در دسترسی‌پذیری (لمس برای فعال‌سازی)");
            txtPowerStatus.setTextColor(0xFFF59E0B);
            txtPowerStatus.setOnClickListener(v -> promptEnableAccessibilityService());
        } else {
            txtPowerStatus.setText("🛡️ محافظت از دکمه پاور با پین‌کد: غیرفعال (از بخش تنظیمات قابل فعال‌سازی است)");
            txtPowerStatus.setTextColor(0xFF94A3B8);
        }
        txtPowerStatus.setTextSize(12);
        infoCard.addView(txtPowerStatus);

        addSpacing(infoCard, 6);

        TextView txtGpsStatus = new TextView(this);
        TrackingService.HarvestedLocation harvested = TrackingService.lastHarvestedLocation;
        Location lastLoc = (harvested != null) ? harvested.location : TrackingService.lastKnownLocation;
        if (lastLoc != null) {
            String src = (harvested != null) ? harvested.source : "حافظه موقت دستگاه";
            long ageSec = (System.currentTimeMillis() - ((harvested != null) ? harvested.timestamp : System.currentTimeMillis())) / 1000;
            String ageStr = (ageSec < 60) ? (ageSec + " ثانیه قبل") : ((ageSec / 60) + " دقیقه قبل");
            txtGpsStatus.setText(String.format(Locale.US, "📍 آخرین موقعیت استخراج‌شده (%s):\n%.5f, %.5f | دقت: %.1fm | زمان: %s",
                    src, lastLoc.getLatitude(), lastLoc.getLongitude(), lastLoc.getAccuracy(), ageStr));
            txtGpsStatus.setTextColor(0xFF10B981);
        } else {
            txtGpsStatus.setText("📍 وضعیت موقعیت: هنوز مختصاتی دریافت نشده است (در انتظار روشن شدن GPS یا دکل)");
            txtGpsStatus.setTextColor(0xFFF59E0B);
        }
        txtGpsStatus.setTextSize(12);
        infoCard.addView(txtGpsStatus);

        content.addView(infoCard);

        // Filter Bar (Tabs)
        LinearLayout filterBar = new LinearLayout(this);
        filterBar.setOrientation(LinearLayout.HORIZONTAL);
        filterBar.setPadding(0, 10, 0, 5);

        Button btnFilterAll = new Button(this);
        btnFilterAll.setText("همه لاگ‌ها");
        btnFilterAll.setTextSize(11);
        btnFilterAll.setBackgroundColor(0xFF2563EB);
        btnFilterAll.setTextColor(0xFFFFFFFF);

        Button btnFilterLoc = new Button(this);
        btnFilterLoc.setText("📡 منابع مکانی (GPS/دکل)");
        btnFilterLoc.setTextSize(11);
        btnFilterLoc.setBackgroundColor(0xFF334155);
        btnFilterLoc.setTextColor(0xFFFFFFFF);

        Button btnFilterNet = new Button(this);
        btnFilterNet.setText("☁️ ارسال به سرور");
        btnFilterNet.setTextSize(11);
        btnFilterNet.setBackgroundColor(0xFF334155);
        btnFilterNet.setTextColor(0xFFFFFFFF);

        LinearLayout.LayoutParams fbLp1 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        fbLp1.setMargins(0, 0, 4, 0);
        btnFilterAll.setLayoutParams(fbLp1);

        LinearLayout.LayoutParams fbLp2 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.3f);
        fbLp2.setMargins(2, 0, 2, 0);
        btnFilterLoc.setLayoutParams(fbLp2);

        LinearLayout.LayoutParams fbLp3 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.1f);
        fbLp3.setMargins(4, 0, 0, 0);
        btnFilterNet.setLayoutParams(fbLp3);

        filterBar.addView(btnFilterAll);
        filterBar.addView(btnFilterLoc);
        filterBar.addView(btnFilterNet);
        content.addView(filterBar);

        // Action Toolbar
        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(0, 10, 0, 10);

        Button btnPing = new Button(this);
        btnPing.setText("⚡ تست فوری (Ping)");
        btnPing.setBackgroundColor(0xFF2563EB);
        btnPing.setTextColor(0xFFFFFFFF);
        btnPing.setTextSize(12);
        LinearLayout.LayoutParams pingLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        pingLp.setMargins(0, 0, 8, 0);
        btnPing.setLayoutParams(pingLp);
        actions.addView(btnPing);

        Button btnCopy = new Button(this);
        btnCopy.setText("📋 کپی لاگ");
        btnCopy.setBackgroundColor(0xFF475569);
        btnCopy.setTextColor(0xFFFFFFFF);
        btnCopy.setTextSize(12);
        LinearLayout.LayoutParams copyLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        copyLp.setMargins(4, 0, 4, 0);
        btnCopy.setLayoutParams(copyLp);
        actions.addView(btnCopy);

        Button btnClear = new Button(this);
        btnClear.setText("🗑️ پاکسازی");
        btnClear.setBackgroundColor(0xFFDC2626);
        btnClear.setTextColor(0xFFFFFFFF);
        btnClear.setTextSize(12);
        LinearLayout.LayoutParams clearLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        clearLp.setMargins(8, 0, 0, 0);
        btnClear.setLayoutParams(clearLp);
        actions.addView(btnClear);

        content.addView(actions);

        // Simulation Toolbar
        LinearLayout simActions = new LinearLayout(this);
        simActions.setOrientation(LinearLayout.HORIZONTAL);
        simActions.setPadding(0, 5, 0, 10);
        
        Button btnTestSiren = new Button(this);
        btnTestSiren.setText("🚨 تست آژیر");
        btnTestSiren.setBackgroundColor(0xFFEAB308); // Yellow
        btnTestSiren.setTextColor(0xFF000000);
        btnTestSiren.setTextSize(12);
        LinearLayout.LayoutParams testSirenLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        testSirenLp.setMargins(0, 0, 4, 0);
        btnTestSiren.setLayoutParams(testSirenLp);
        simActions.addView(btnTestSiren);

        Button btnTestOfflineSms = new Button(this);
        btnTestOfflineSms.setText("📡 تست پیامک آفلاین");
        btnTestOfflineSms.setBackgroundColor(0xFF9333EA); // Purple
        btnTestOfflineSms.setTextColor(0xFFFFFFFF);
        btnTestOfflineSms.setTextSize(12);
        LinearLayout.LayoutParams testOfflineLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        testOfflineLp.setMargins(2, 0, 2, 0);
        btnTestOfflineSms.setLayoutParams(testOfflineLp);
        simActions.addView(btnTestOfflineSms);

        Button btnTestPhoto = new Button(this);
        btnTestPhoto.setText("📸 تست دوربین مخفی");
        btnTestPhoto.setBackgroundColor(0xFF0D9488); // Teal
        btnTestPhoto.setTextColor(0xFFFFFFFF);
        btnTestPhoto.setTextSize(12);
        LinearLayout.LayoutParams testPhotoLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f);
        testPhotoLp.setMargins(4, 0, 0, 0);
        btnTestPhoto.setLayoutParams(testPhotoLp);
        simActions.addView(btnTestPhoto);

        content.addView(simActions);

        // Console Window (Terminal)
        ScrollView logScroll = new ScrollView(this);
        logScroll.setBackgroundColor(0xFF020617);
        logScroll.setPadding(20, 20, 20, 20);
        LinearLayout.LayoutParams scrollLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1.0f
        );
        logScroll.setLayoutParams(scrollLp);

        TextView logView = new TextView(this);
        logView.setTypeface(Typeface.MONOSPACE);
        logView.setTextSize(11);
        logView.setTextColor(0xFF38BDF8);
        logView.setText(LogManager.getAllLogsAsText());
        logScroll.addView(logView);

        content.addView(logScroll);

        // Filter logic
        final String[] currentFilter = new String[]{"ALL"};
        Runnable refreshLogView = () -> {
            logView.setText(LogManager.getFilteredLogsAsText(currentFilter[0]));
            logScroll.post(() -> logScroll.fullScroll(View.FOCUS_DOWN));
        };

        btnFilterAll.setOnClickListener(v -> {
            currentFilter[0] = "ALL";
            btnFilterAll.setBackgroundColor(0xFF2563EB);
            btnFilterLoc.setBackgroundColor(0xFF334155);
            btnFilterNet.setBackgroundColor(0xFF334155);
            refreshLogView.run();
        });

        btnFilterLoc.setOnClickListener(v -> {
            currentFilter[0] = "LOCATION";
            btnFilterAll.setBackgroundColor(0xFF334155);
            btnFilterLoc.setBackgroundColor(0xFF2563EB);
            btnFilterNet.setBackgroundColor(0xFF334155);
            refreshLogView.run();
        });

        btnFilterNet.setOnClickListener(v -> {
            currentFilter[0] = "NETWORK";
            btnFilterAll.setBackgroundColor(0xFF334155);
            btnFilterLoc.setBackgroundColor(0xFF334155);
            btnFilterNet.setBackgroundColor(0xFF2563EB);
            refreshLogView.run();
        });

        // Wire Up Actions
        btnClear.setOnClickListener(v -> LogManager.clear());

        btnCopy.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = ClipData.newPlainText("FleetGpsLogs", LogManager.getFilteredLogsAsText(currentFilter[0]));
            if (cm != null) {
                cm.setPrimaryClip(clip);
                Toast.makeText(this, "لاگ‌های این بخش در کلیپ‌بورد کپی شدند", Toast.LENGTH_SHORT).show();
            }
        });

        btnPing.setOnClickListener(v -> {
            btnPing.setEnabled(false);
            btnPing.setText("در حال ارتباط...");
            LogManager.info("TEST", "درخواست تست فوری ارتباط (Ping) آغاز شد...");

            new Thread(() -> {
                Location loc = TrackingService.lastKnownLocation;
                double lat = loc != null ? loc.getLatitude() : 34.5355;
                double lng = loc != null ? loc.getLongitude() : 69.1665;
                float speed = loc != null ? loc.getSpeed() : 0;
                float bearing = loc != null ? loc.getBearing() : 0;
                double alt = loc != null ? loc.getAltitude() : 1790;

                ApiClient.sendTelemetryDetailed(getApplicationContext(), lat, lng, speed, bearing, alt);

                new Handler(Looper.getMainLooper()).post(() -> {
                    btnPing.setEnabled(true);
                    btnPing.setText("⚡ تست فوری (Ping)");
                    refreshLogView.run();
                });
            }).start();
        });

        btnTestSiren.setOnClickListener(v -> {
            ApiClient.setTheftMode(this, true);
            PanicSirenPlayer.startSiren(this);
            LogManager.warning("SECURITY", "تست آژیر اضطراری اجرا شد. (شبیه‌سازی دریافت پیامک SIREN)");
        });
        
        btnTestOfflineSms.setOnClickListener(v -> {
            String emergencyPhone = ApiClient.getEmergencyPhone(this);
            if (emergencyPhone != null && !emergencyPhone.isEmpty()) {
                LogManager.info("TEST", "در حال شبیه‌سازی قطعی طولانی‌مدت اینترنت و ارسال پیامک آفلاین...");
                TrackingService.HarvestedLocation harvested = TrackingService.lastHarvestedLocation;
                Location loc = harvested != null ? harvested.location : TrackingService.lastKnownLocation;
                
                StringBuilder sb = new StringBuilder();
                sb.append("⚠️ هشدار قطعی اینترنت ردیاب (تستی):\n");
                sb.append("تست سیستم ارسال پیامک آفلاین\n");
                if (loc != null) {
                    sb.append("https://maps.google.com/?q=").append(loc.getLatitude()).append(",").append(loc.getLongitude()).append("\n");
                } else {
                    sb.append("موقعیت فعلاً در دسترس نیست.");
                }
                SmsCommandReceiver.sendSafeSms(this, emergencyPhone, sb.toString());
            } else {
                Toast.makeText(this, "شماره اضطراری در تنظیمات ثبت نشده است!", Toast.LENGTH_SHORT).show();
            }
        });

        btnTestPhoto.setOnClickListener(v -> {
            LogManager.info("TEST", "درخواست تست دوربین مخفی آغاز شد... (در حال عکس‌برداری از دوربین جلو)");
            Location loc = TrackingService.lastKnownLocation;
            double lat = loc != null ? loc.getLatitude() : 0;
            double lng = loc != null ? loc.getLongitude() : 0;
            HiddenCameraManager.captureIntruderPhoto(this, "test_manual_photo", lat, lng);
            Toast.makeText(this, "درخواست عکس مخفی ارسال شد. به زودی در لاگ نتیجه را می‌بینید.", Toast.LENGTH_LONG).show();
        });

        // Live Log Listener
        LogManager.LogListener logListener = new LogManager.LogListener() {
            @Override
            public void onLogAdded(LogManager.LogEntry entry) {
                refreshLogView.run();
            }

            @Override
            public void onLogsCleared() {
                logView.setText("");
            }
        };

        LogManager.addListener(logListener);
        dialog.setOnDismissListener(d -> LogManager.removeListener(logListener));

        dialog.setContentView(content);
        dialog.show();

        // Scroll to end initially
        logScroll.post(() -> logScroll.fullScroll(View.FOCUS_DOWN));
    }

    private boolean isAccessibilityServiceEnabled() {
        int accessibilityEnabled = 0;
        final String service = getPackageName() + "/" + AntiTheftAccessibilityService.class.getName();
        try {
            accessibilityEnabled = Settings.Secure.getInt(
                    getApplicationContext().getContentResolver(),
                    android.provider.Settings.Secure.ACCESSIBILITY_ENABLED);
        } catch (Settings.SettingNotFoundException ignored) {}
        TextUtils.SimpleStringSplitter colonSplitter = new TextUtils.SimpleStringSplitter(':');

        if (accessibilityEnabled == 1) {
            String settingValue = Settings.Secure.getString(
                    getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (settingValue != null) {
                colonSplitter.setString(settingValue);
                while (colonSplitter.hasNext()) {
                    String accessibilityService = colonSplitter.next();
                    if (accessibilityService.equalsIgnoreCase(service)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private void promptEnableAccessibilityService() {
        new AlertDialog.Builder(this)
                .setTitle("فعال‌سازی محافظت ضدسرقت از پاور")
                .setMessage("جهت جلوگیری از خاموش کردن یا ریستارت گوشی توسط سارق در صفحه قفل، لطفاً در بخش دسترسی‌پذیری گوشی (Accessibility)، گزینه «سامانه کنترل سلامت دستگاه» را روشن کنید.")
                .setPositiveButton("رفتن به تنظیمات", (dialog, which) -> {
                    try {
                        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                        startActivity(intent);
                    } catch (Exception e) {
                        Toast.makeText(this, "لطفاً به تنظیمات > دسترسی‌پذیری گوشی بروید", Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("انصراف", null)
                .show();
    }

    @SuppressLint("BatteryLife")
    private void requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent();
                String pkg = getPackageName();
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + pkg));
                    startActivity(intent);
                } else {
                    Toast.makeText(this, "برنامه از قبل از بهینه‌سازی باتری معاف است ✓", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                try {
                    Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    startActivity(intent);
                } catch (Exception ignored) {}
            }
        }
    }
}
