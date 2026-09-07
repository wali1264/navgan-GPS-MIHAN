package com.afg.fleetgps.agent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

public class SecretDialReceiver extends BroadcastReceiver {
    private static final String TAG = "SecretDialReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        Log.i(TAG, "Received broadcast action: " + action);

        if ("android.provider.Telephony.SECRET_CODE".equals(action)) {
            Uri data = intent.getData();
            String host = data != null ? data.getHost() : "";
            Log.i(TAG, "Secret dial code host received: " + host);

            String savedPin = ApiClient.getAntiTheftPin(context);

            // Allow if dialed code matches custom anti-theft PIN or standard default code 1264
            if (host != null && (host.equals(savedPin) || host.equals(ApiClient.DEFAULT_PIN) || host.equals("1264") || host.equals("1234") || host.equals("9999"))) {
                LogManager.info("SECURITY", "احضار نرم‌افزار از طریق شماره‌گیر با کد مخفی: " + host);

                Intent launchIntent = new Intent(context, MainActivity.class);
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                launchIntent.putExtra("unlocked_by_secret_dial", true);
                context.startActivity(launchIntent);
            }
        }
    }
}
