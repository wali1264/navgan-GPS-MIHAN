package com.afg.fleetgps.agent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class SmsSentReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (SmsRetryManager.ACTION_SMS_SENT.equals(intent.getAction())) {
            SmsRetryManager.handleSmsSentResult(context, intent, getResultCode());
        }
    }
}
