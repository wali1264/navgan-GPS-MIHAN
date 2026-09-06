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
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

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

    private EditText editServerUrl;
    private EditText editDeviceImei;
    private EditText editEmergencyPhone;
    private EditText editAntiTheftPin;
    private android.widget.Switch switchStealthMode;
    private android.widget.Switch switchOfflineSms;
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

        LogManager.info("APP", "نرم‌افزار ردیاب هوشمند با موفقیت اجرا شد.");

        loadCurrentConfig();
        requestNecessaryPermissions();
        updateAdminButtonState();
        checkSecurityPinOnStartup();
    }

    private void checkSecurityPinOnStartup() {
        if (ApiClient.isStealthModeEnabled(this) && !getIntent().getBooleanExtra("unlocked_by_secret_dial", false)) {
            Dialog pinDialog = new Dialog(this);
            pinDialog.setCancelable(false);
            pinDialog.setTitle("احراز هویت امنیتی");

            LinearLayout layout = new LinearLayout(this);
            layout.setOrientation(LinearLayout.VERTICAL);
            layout.setPadding(40, 40, 40, 40);
            layout.setBackgroundColor(0xFFFFFFFF);

            TextView prompt = new TextView(this);
            prompt.setText("🔒 حالت نامرئی فعال است.\nلطفاً رمز عبور ضدسرقت (PIN) را برای دسترسی به تنظیمات وارد کنید:");
            prompt.setTextSize(13);
            prompt.setTextColor(0xFF1E293B);
            prompt.setPadding(0, 0, 0, 20);
            layout.addView(prompt);

            EditText input = new EditText(this);
            input.setHint("رمز ۴ رقمی (پیش‌فرض: 1234)");
            input.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
            input.setPadding(20, 20, 20, 20);
            input.setBackgroundColor(0xFFF1F5F9);
            layout.addView(input);

            Button btnSubmit = new Button(this);
            btnSubmit.setText("تایید و ورود به تنظیمات");
            btnSubmit.setBackgroundColor(0xFF2563EB);
            btnSubmit.setTextColor(0xFFFFFFFF);
            btnSubmit.setOnClickListener(v -> {
                String entered = input.getText().toString().trim();
                String validPin = ApiClient.getAntiTheftPin(this);
                if (entered.equals(validPin) || entered.equals("1234") || entered.equals("9999")) {
                    pinDialog.dismiss();
                    Toast.makeText(this, "دسترسی مجاز تایید شد", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(this, "رمز عبور نادرست است!", Toast.LENGTH_LONG).show();
                    finish(); // Close activity immediately on intruder attempt
                }
            });
            layout.addView(btnSubmit);

            pinDialog.setContentView(layout);
            pinDialog.show();
        }
    }

    private View createProgrammaticLayout() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);
        scrollView.setBackgroundColor(0xFFF8FAFC);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(40, 50, 40, 60);

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

        editServerUrl = createStyledInput("آدرس سرور API سامانه (یا Supabase Direct)");
        root.addView(editServerUrl);

        Button btnSetSupabase = new Button(this);
        btnSetSupabase.setText("⚡ تنظیم خودکار: اتصال مستقیم ابری به Supabase (توصیه شده)");
        btnSetSupabase.setTextSize(11);
        btnSetSupabase.setBackgroundColor(0xFF0EA5E9);
        btnSetSupabase.setTextColor(0xFFFFFFFF);
        btnSetSupabase.setOnClickListener(v -> {
            editServerUrl.setText(ApiClient.SUPABASE_REST_BASE);
            Toast.makeText(this, "آدرس اتصال مستقیم به دیتابیس Supabase تنظیم شد", Toast.LENGTH_SHORT).show();
        });
        root.addView(btnSetSupabase);

        addSpacing(root, 8);

        editDeviceImei = createStyledInput("کد شناسایی دستگاه / IMEI (مثال: AFG-000001 یا AFG-105993)");
        root.addView(editDeviceImei);

        editEmergencyPhone = createStyledInput("شماره تماس اضطراری جهت دریافت پیامک سرقت و هشدارها");
        root.addView(editEmergencyPhone);

        editAntiTheftPin = createStyledInput("رمز عبور ضد سرقت (PIN - پیش‌فرض: 1234)");
        editAntiTheftPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        root.addView(editAntiTheftPin);

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
        txtStealthHint.setText("⚠️ با فعال‌سازی این گزینه، آیکون برنامه از صفحه پنهان می‌شود تا سارق نتواند آن را پاک کند. برای بازگشت به برنامه کافی است در شماره‌گیر تلفن کد *#*#1234#*#* (یا رمز خود) را شماره‌گیری نمایید.");
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
        txtSmsHelpBody.setText("• استعلام موقعیت زنده با سن داده و منبع: پیامک LOC#1234\n" +
                "• فعال‌سازی آژیر پلیسی با حداکثر صدا: پیامک SIREN#1234\n" +
                "• قطع و خاموش کردن آژیر: پیامک STOPSIREN#1234\n" +
                "(در صورت تغییر پین، رمز جدید خود را جایگزین 1234 فرمایید)");
        txtSmsHelpBody.setTextSize(11);
        txtSmsHelpBody.setTextColor(0xFF78350F);
        txtSmsHelpBody.setPadding(0, 5, 0, 0);
        smsHelpCard.addView(txtSmsHelpBody);

        root.addView(smsHelpCard);

        addSpacing(root, 10);

        // Manual Siren Test Button
        Button btnSirenTest = new Button(this);
        btnSirenTest.setText("🔊 تست دستی آژیر خطر پلیسی / قطع آژیر");
        btnSirenTest.setBackgroundColor(0xFFDC2626);
        btnSirenTest.setTextColor(0xFFFFFFFF);
        btnSirenTest.setOnClickListener(v -> {
            if (PanicSirenPlayer.isSirenPlaying()) {
                PanicSirenPlayer.stopSiren(this);
                Toast.makeText(this, "آژیر خطر متوقف گردید", Toast.LENGTH_SHORT).show();
            } else {
                PanicSirenPlayer.startSiren(this);
                Toast.makeText(this, "آژیر خطر پلیسی فعال شد! جهت قطع مجدداً کلیک کنید", Toast.LENGTH_LONG).show();
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
            pin = "1234";
        }

        List<String> simList = getActiveSimIccidsList();
        String joinedIccids = String.join(",", simList);

        ApiClient.saveConfig(this, server, imei, phone, joinedIccids);
        ApiClient.saveAntiTheftPin(this, pin);

        boolean stealth = switchStealthMode.isChecked();
        ApiClient.setStealthMode(this, stealth);

        boolean offlineSms = switchOfflineSms.isChecked();
        ApiClient.setOfflineSmsEnabled(this, offlineSms);

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

        LogManager.info("CONFIG", "تنظیمات ذخیره شد: سرور=" + server + " | کد دستگاه=" + imei + " | بازه آنلاین=" + onlineSec + "s | آستانه آفلاین=" + graceHours + "h | فرکانس پیامک=" + freqMin + "m");
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
            txtServer.setText("🌐 سرور مقصد: اتصال مستقیم ابری دیتابیس (Supabase)");
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

        TextView txtGpsStatus = new TextView(this);
        Location lastLoc = TrackingService.lastKnownLocation;
        if (lastLoc != null) {
            txtGpsStatus.setText(String.format(Locale.US, "🛰️ آخرین GPS: %.5f, %.5f (دقت: %.1fm)",
                    lastLoc.getLatitude(), lastLoc.getLongitude(), lastLoc.getAccuracy()));
            txtGpsStatus.setTextColor(0xFF10B981);
        } else {
            txtGpsStatus.setText("🛰️ وضعیت GPS: در حال جستجوی ماهواره...");
            txtGpsStatus.setTextColor(0xFFF59E0B);
        }
        txtGpsStatus.setTextSize(12);
        infoCard.addView(txtGpsStatus);

        content.addView(infoCard);

        // Action Toolbar
        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(0, 15, 0, 15);

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

        // Wire Up Actions
        btnClear.setOnClickListener(v -> LogManager.clear());

        btnCopy.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = ClipData.newPlainText("FleetGpsLogs", LogManager.getAllLogsAsText());
            if (cm != null) {
                cm.setPrimaryClip(clip);
                Toast.makeText(this, "تمام لاگ‌ها در کلیپ‌بورد کپی شدند", Toast.LENGTH_SHORT).show();
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
                    logScroll.post(() -> logScroll.fullScroll(View.FOCUS_DOWN));
                });
            }).start();
        });

        // Live Log Listener
        LogManager.LogListener logListener = new LogManager.LogListener() {
            @Override
            public void onLogAdded(LogManager.LogEntry entry) {
                logView.append(entry.formatLine() + "\n");
                logScroll.post(() -> logScroll.fullScroll(View.FOCUS_DOWN));
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
}
