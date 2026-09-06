package com.afg.fleetgps.agent;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;

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

    private DevicePolicyManager devicePolicyManager;
    private ComponentName compName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(createProgrammaticLayout());

        devicePolicyManager = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        compName = new ComponentName(this, IntruderDetectorAdminReceiver.class);

        loadCurrentConfig();
        requestNecessaryPermissions();
        updateAdminButtonState();
    }

    private View createProgrammaticLayout() {
        android.widget.LinearLayout root = new android.widget.LinearLayout(this);
        root.setOrientation(android.widget.LinearLayout.VERTICAL);
        root.setPadding(40, 60, 40, 40);
        root.setBackgroundColor(0xFFF8FAFC);

        TextView title = new TextView(this);
        title.setText("🛡️ ردیاب هوشمند و ضد سرقت موبایل");
        title.setTextSize(18);
        title.setTextColor(0xFF0F172A);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setGravity(android.view.Gravity.CENTER);
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("اتصال به سامانه پایش و مانیتورینگ");
        subtitle.setTextSize(12);
        subtitle.setTextColor(0xFF64748B);
        subtitle.setGravity(android.view.Gravity.CENTER);
        subtitle.setPadding(0, 10, 0, 40);
        root.addView(subtitle);

        editServerUrl = createStyledInput("آدرس سرور API سامانه (مثال: https://fleet.example.com)");
        root.addView(editServerUrl);

        editDeviceImei = createStyledInput("کد شناسایی دستگاه / IMEI (مثال: AFG-829104)");
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

        android.widget.Space space1 = new android.widget.Space(this);
        space1.setMinimumHeight(20);
        root.addView(space1);

        btnToggleService = new Button(this);
        btnToggleService.setText("▶ شروع ردیابی پس‌زمینه");
        btnToggleService.setBackgroundColor(0xFF10B981);
        btnToggleService.setTextColor(0xFFFFFFFF);
        btnToggleService.setOnClickListener(v -> startTrackingService());
        root.addView(btnToggleService);

        android.widget.Space space2 = new android.widget.Space(this);
        space2.setMinimumHeight(20);
        root.addView(space2);

        btnEnableAdmin = new Button(this);
        btnEnableAdmin.setText("🔒 فعال‌سازی دسترسی ضد سرقت (Device Admin)");
        btnEnableAdmin.setBackgroundColor(0xFF475569);
        btnEnableAdmin.setTextColor(0xFFFFFFFF);
        btnEnableAdmin.setOnClickListener(v -> enableDeviceAdmin());
        root.addView(btnEnableAdmin);

        txtStatus = new TextView(this);
        txtStatus.setTextSize(12);
        txtStatus.setTextColor(0xFF10B981);
        txtStatus.setGravity(android.view.Gravity.CENTER);
        txtStatus.setPadding(0, 30, 0, 0);
        root.addView(txtStatus);

        return root;
    }

    private EditText createStyledInput(String hint) {
        EditText et = new EditText(this);
        et.setHint(hint);
        et.setTextSize(13);
        et.setPadding(25, 25, 25, 25);
        et.setBackgroundColor(0xFFFFFFFF);
        android.widget.LinearLayout.LayoutParams lp = new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        lp.setMargins(0, 10, 0, 15);
        et.setLayoutParams(lp);
        return et;
    }

    private void loadCurrentConfig() {
        editServerUrl.setText(ApiClient.getServerUrl(this));
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
        Toast.makeText(this, "تنظیمات امنیتی و سیمکارت‌های مجاز ذخیره شد", Toast.LENGTH_SHORT).show();
        txtStatus.setText("✓ " + (simList.size() > 1 ? "هر ۲ سیمکارت" : "سیمکارت") + " به عنوان سیمکارت مجاز ثبت گردید.");
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
        Intent serviceIntent = new Intent(this, TrackingService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        txtStatus.setText("✓ سرویس ردیابی زنده فعال است.");
        Toast.makeText(this, "سرویس مانیتورینگ آنلاین با موفقیت روشن شد", Toast.LENGTH_SHORT).show();
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
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == ADMIN_REQ_CODE) {
            updateAdminButtonState();
        }
    }
}
