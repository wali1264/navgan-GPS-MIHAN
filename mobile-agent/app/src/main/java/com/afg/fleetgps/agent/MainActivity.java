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

        editEmergencyPhone = createStyledInput("شماره تماس اضطراری جهت دریافت پیامک سرقت");
        root.addView(editEmergencyPhone);

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

        if (imei.isEmpty()) {
            Toast.makeText(this, "لطفاً شناسه دستگاه را وارد کنید", Toast.LENGTH_SHORT).show();
            return;
        }

        List<String> simList = getActiveSimIccidsList();
        String joinedIccids = String.join(",", simList);

        ApiClient.saveConfig(this, server, imei, phone, joinedIccids);
        LogManager.info("CONFIG", "تنظیمات ذخیره شد: سرور=" + server + " | کد دستگاه=" + imei);
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
