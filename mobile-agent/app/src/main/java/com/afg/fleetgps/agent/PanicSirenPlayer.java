package com.afg.fleetgps.agent;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

public class PanicSirenPlayer {
    private static final String TAG = "PanicSirenPlayer";
    private static volatile boolean isPlaying = false;
    private static Thread sirenThread = null;
    private static Ringtone fallbackRingtone = null;
    private static Handler autoStopHandler = null;

    public static synchronized boolean isSirenPlaying() {
        return isPlaying;
    }

    public static synchronized void startSiren(Context context) {
        if (isPlaying) {
            Log.w(TAG, "Siren is already playing.");
            return;
        }
        isPlaying = true;
        LogManager.warning("SECURITY", "🚨 آژیر خطر ضدسرقت با حداکثر توان بلندگوی گوشی فعال شد!");

        // Force maximum alarm volume
        forceMaxVolume(context);

        // Start synthesizing emergency sweep siren in background thread
        sirenThread = new Thread(() -> {
            AudioTrack audioTrack = null;
            try {
                int sampleRate = 44100;
                int minBufferSize = AudioTrack.getMinBufferSize(
                        sampleRate,
                        AudioFormat.CHANNEL_OUT_MONO,
                        AudioFormat.ENCODING_PCM_16BIT
                );
                int bufferSize = Math.max(minBufferSize, sampleRate / 2);

                audioTrack = new AudioTrack.Builder()
                        .setAudioAttributes(new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ALARM)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .build())
                        .setAudioFormat(new AudioFormat.Builder()
                                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                                .setSampleRate(sampleRate)
                                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                                .build())
                        .setBufferSizeInBytes(bufferSize)
                        .setTransferMode(AudioTrack.MODE_STREAM)
                        .build();

                audioTrack.play();

                short[] buffer = new short[sampleRate / 4]; // 250ms chunks
                double phase = 0.0;
                long startTime = System.currentTimeMillis();

                while (isPlaying) {
                    // Re-enforce maximum volume every 2 seconds in case intruder tries to turn it down
                    if (System.currentTimeMillis() - startTime > 2000) {
                        forceMaxVolume(context);
                        startTime = System.currentTimeMillis();
                    }

                    // Police frequency sweep: oscillates between 800 Hz and 1800 Hz over a 0.8s cycle
                    double cycleTime = (System.currentTimeMillis() % 800) / 800.0;
                    double currentFreq = 800.0 + (1000.0 * Math.sin(cycleTime * Math.PI));

                    double phaseIncrement = (2.0 * Math.PI * currentFreq) / sampleRate;
                    for (int i = 0; i < buffer.length; i++) {
                        buffer[i] = (short) (Math.sin(phase) * 32767);
                        phase += phaseIncrement;
                        if (phase > 2.0 * Math.PI) {
                            phase -= 2.0 * Math.PI;
                        }
                    }

                    audioTrack.write(buffer, 0, buffer.length);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error during AudioTrack siren synthesis: " + e.getMessage());
                // Fallback to system ringtone
                playFallbackRingtone(context);
            } finally {
                if (audioTrack != null) {
                    try {
                        audioTrack.stop();
                        audioTrack.release();
                    } catch (Exception ignored) {}
                }
            }
        });
        sirenThread.setPriority(Thread.MAX_PRIORITY);
        sirenThread.start();

        // Auto-stop after 5 minutes to prevent infinite battery drain if lost
        if (autoStopHandler == null) {
            autoStopHandler = new Handler(Looper.getMainLooper());
        }
        autoStopHandler.postDelayed(() -> {
            if (isPlaying) {
                LogManager.info("SECURITY", "تایمر ۵ دقیقه‌ای آژیر خطر منقضی شد و آژیر متوقف گردید.");
                stopSiren(context);
            }
        }, 5 * 60 * 1000L);
    }

    private static void playFallbackRingtone(Context context) {
        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            fallbackRingtone = RingtoneManager.getRingtone(context, alarmUri);
            if (fallbackRingtone != null) {
                fallbackRingtone.play();
            }
        } catch (Exception ex) {
            Log.e(TAG, "Fallback ringtone failed: " + ex.getMessage());
        }
    }

    public static synchronized void stopSiren(Context context) {
        if (!isPlaying) return;
        isPlaying = false;
        LogManager.info("SECURITY", "🔇 آژیر خطر ضدسرقت خاموش و متوقف گردید.");

        if (fallbackRingtone != null) {
            try {
                if (fallbackRingtone.isPlaying()) {
                    fallbackRingtone.stop();
                }
            } catch (Exception ignored) {}
            fallbackRingtone = null;
        }

        if (sirenThread != null) {
            sirenThread.interrupt();
            sirenThread = null;
        }
    }

    private static void forceMaxVolume(Context context) {
        try {
            AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                int maxAlarm = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                am.setStreamVolume(AudioManager.STREAM_ALARM, maxAlarm, 0);

                int maxMusic = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                am.setStreamVolume(AudioManager.STREAM_MUSIC, maxMusic, 0);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error forcing max volume: " + e.getMessage());
        }
    }
}
