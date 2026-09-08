package com.afg.fleetgps.agent;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;

public class FakeShutdownActivity extends Activity {

    public static boolean isFakePowerOffActive = false;
    private View menuLayout;
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

        setContentView(R.layout.activity_fake_shutdown);

        menuLayout = findViewById(R.id.menuLayout);
        blackScreen = findViewById(R.id.blackScreen);

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

        findViewById(R.id.powerOffBtn).setOnClickListener(v -> enterFakePowerOff());
        findViewById(R.id.restartBtn).setOnClickListener(v -> enterFakePowerOff());

        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_POWER_CONNECTED);
        registerReceiver(chargerReceiver, filter);

        if (isFakePowerOffActive) {
            enterFakePowerOff();
        }
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
