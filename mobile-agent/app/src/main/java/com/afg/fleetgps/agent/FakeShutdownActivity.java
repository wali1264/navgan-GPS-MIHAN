package com.afg.fleetgps.agent;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

public class FakeShutdownActivity extends Activity {

    public static boolean isFakePowerOffActive = false;
    private LinearLayout menuLayout;
    private View blackScreen;
    private int secretTapCount = 0;
    private long lastTapTime = 0;

    private final BroadcastReceiver chargerReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (Intent.ACTION_POWER_CONNECTED.equals(action)) {
                exitFakeShutdown();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_FULLSCREEN |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );
        hideSystemUI();

        ViewGroup.LayoutParams matchParent = new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        
        android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        root.setLayoutParams(matchParent);
        root.setBackgroundColor(Color.BLACK);

        blackScreen = new View(this);
        blackScreen.setLayoutParams(matchParent);
        blackScreen.setBackgroundColor(Color.BLACK);
        blackScreen.setVisibility(View.GONE);

        // Secret exit tap listener (5 rapid taps to exit fake shutdown state)
        blackScreen.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                long currentTime = System.currentTimeMillis();
                if (currentTime - lastTapTime > 1000) {
                    secretTapCount = 0;
                }
                lastTapTime = currentTime;
                secretTapCount++;
                if (secretTapCount >= 5) {
                    exitFakeShutdown();
                }
            }
            return true; // Consume touch to pretend the screen is dead
        });

        menuLayout = new LinearLayout(this);
        menuLayout.setOrientation(LinearLayout.VERTICAL);
        menuLayout.setGravity(Gravity.CENTER);
        android.widget.FrameLayout.LayoutParams menuParams = new android.widget.FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        menuParams.gravity = Gravity.CENTER;
        menuLayout.setLayoutParams(menuParams);
        
        TextView powerOffBtn = createMenuButton("خاموش کردن (Power Off)", 0xFFE53935);
        powerOffBtn.setOnClickListener(v -> enterFakePowerOff());
        
        TextView restartBtn = createMenuButton("راه‌اندازی مجدد (Restart)", 0xFF43A047);
        restartBtn.setOnClickListener(v -> enterFakePowerOff());

        menuLayout.addView(powerOffBtn);
        menuLayout.addView(restartBtn);

        root.addView(menuLayout);
        root.addView(blackScreen);
        
        setContentView(root);

        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_POWER_CONNECTED);
        registerReceiver(chargerReceiver, filter);

        if (isFakePowerOffActive) {
            enterFakePowerOff();
        }
    }

    private TextView createMenuButton(String text, int bgColor) {
        TextView btn = new TextView(this);
        btn.setText(text);
        btn.setTextColor(Color.WHITE);
        btn.setTextSize(20);
        btn.setGravity(Gravity.CENTER);
        btn.setBackgroundColor(bgColor);
        btn.setPadding(40, 60, 40, 60);
        
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.setMargins(80, 20, 80, 20);
        btn.setLayoutParams(params);
        return btn;
    }

    private void enterFakePowerOff() {
        isFakePowerOffActive = true;
        menuLayout.setVisibility(View.GONE);
        blackScreen.setVisibility(View.VISIBLE);
        hideSystemUI();
        
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.screenBrightness = 0.0f; // Turn off backlight as much as OS allows
        getWindow().setAttributes(params);

        // Put the tracker into Theft Mode since an unauthorized power off was attempted
        ApiClient.setTheftMode(this, true);
        LogManager.warning("SECURITY", "حالت خاموشی جعلی فعال شد و به سارق نمایش داده می‌شود.");
    }

    private void exitFakeShutdown() {
        isFakePowerOffActive = false;
        ApiClient.setTheftMode(this, false);
        finish();
    }

    private void hideSystemUI() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    public void onBackPressed() {
        // Block back button if fake power off is active, otherwise behave normally
        if (!isFakePowerOffActive) {
            super.onBackPressed();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (isFakePowerOffActive) {
            return true; // Block physical volume keys to reinforce the illusion of a dead phone
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUI();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        try {
            unregisterReceiver(chargerReceiver);
        } catch (Exception e) {}
        isFakePowerOffActive = false;
    }
}
