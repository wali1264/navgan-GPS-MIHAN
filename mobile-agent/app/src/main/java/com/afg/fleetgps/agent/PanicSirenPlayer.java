package com.afg.fleetgps.agent;

import android.content.Context;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

/**
 * PanicSirenPlayer
 * High-decibel aggressive emergency siren system.
 * Features:
 *  1. Ear-piercing dual-tone & square/sawtooth harmonic synthesis (1000Hz - 3400Hz).
 *  2. 100% Volume enforcement across all audio streams (Alarm, Music, Ring, System).
 *  3. Violent continuous rhythmic haptic vibration pulse.
 *  4. High-frequency camera LED strobe flashlight (120ms intervals).
 *  5. Automatic 5-minute timeout protection with manual stop.
 */
public class PanicSirenPlayer {
    private static final String TAG = "PanicSirenPlayer";
    private static volatile boolean isPlaying = false;
    private static Thread sirenThread = null;
    private static Thread flashThread = null;
    private static Handler autoStopHandler = null;
    private static ToneGenerator fallbackTone = null;

    public static synchronized boolean isSirenPlaying() {
        return isPlaying;
    }

    public static synchronized void startSiren(Context context) {
        if (isPlaying) {
            Log.w(TAG, "Siren is already playing.");
            return;
        }
        isPlaying = true;
        LogManager.warning("SECURITY", "🚨 آژیر خطر وحشت ضدسرقت با حداکثر توان، ویبره کوبنده و فلاش استروب فعال شد!");

        // Force maximum volume across all streams
        forceMaxVolume(context);

        // Start violent vibration
        startVibration(context);

        // Start camera flash strobe
        startFlashStrobe(context);

        // Start synthesizing harsh aggressive scream siren in background thread
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

                short[] buffer = new short[sampleRate / 4]; // ~250ms chunks
                double phase1 = 0.0;
                double phase2 = 0.0;
                long startTime = System.currentTimeMillis();

                while (isPlaying) {
                    // Re-enforce maximum volume every 1.5s against unauthorized silencing attempts
                    if (System.currentTimeMillis() - startTime > 1500) {
                        forceMaxVolume(context);
                        startTime = System.currentTimeMillis();
                    }

                    long now = System.currentTimeMillis();
                    // Fast piercing yelp & scream modulation cycle (500ms cycle)
                    int cyclePhase = (int) (now % 500);
                    double currentFreq;

                    if (cyclePhase < 250) {
                        // High-pitched upward scream sweep: 1400 Hz to 3200 Hz
                        double progress = cyclePhase / 250.0;
                        currentFreq = 1400.0 + (1800.0 * progress);
                    } else {
                        // Sharp cutting ambulance drop & warble: 3200 Hz down to 1200 Hz
                        double progress = (cyclePhase - 250) / 250.0;
                        currentFreq = 3200.0 - (2000.0 * progress);
                    }

                    // Secondary piercing tone for inter-modulation distortion that rattles the ear canal
                    double secondaryFreq = (currentFreq > 2200) ? 950.0 : 2800.0;

                    double phaseIncrement1 = (2.0 * Math.PI * currentFreq) / sampleRate;
                    double phaseIncrement2 = (2.0 * Math.PI * secondaryFreq) / sampleRate;

                    for (int i = 0; i < buffer.length; i++) {
                        // Rich square-sawtooth harmonic compound wave:
                        // Combining fundamental, 3rd, and 5th harmonics with hard clipping for maximum acoustic volume
                        double rawWave1 = Math.sin(phase1) + 0.5 * Math.sin(3.0 * phase1) + 0.25 * Math.sin(5.0 * phase1);
                        double rawWave2 = Math.sin(phase2);

                        double mixed = (0.75 * rawWave1) + (0.35 * rawWave2);

                        // Hard-limiting / clipping to create aggressive cutting distortion
                        if (mixed > 0.85) mixed = 1.0;
                        else if (mixed < -0.85) mixed = -1.0;
                        else mixed = mixed / 0.85;

                        buffer[i] = (short) (mixed * 32767);

                        phase1 += phaseIncrement1;
                        if (phase1 > 2.0 * Math.PI) phase1 -= 2.0 * Math.PI;

                        phase2 += phaseIncrement2;
                        if (phase2 > 2.0 * Math.PI) phase2 -= 2.0 * Math.PI;
                    }

                    audioTrack.write(buffer, 0, buffer.length);
                }
            } catch (Exception e) {
                Log.e(TAG, "AudioTrack aggressive synthesis error: " + e.getMessage());
                playHighDecibelFallback(context);
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

        // Auto-stop after 5 minutes to prevent infinite battery exhaustion
        if (autoStopHandler == null) {
            autoStopHandler = new Handler(Looper.getMainLooper());
        }
        autoStopHandler.postDelayed(() -> {
            if (isPlaying) {
                LogManager.info("SECURITY", "تایمر ۵ دقیقه‌ای آژیر خطر منقضی شد و آژیر به طور خودکار خاموش گردید.");
                stopSiren(context);
            }
        }, 5 * 60 * 1000L);
    }

    private static void playHighDecibelFallback(Context context) {
        try {
            forceMaxVolume(context);
            if (fallbackTone == null) {
                fallbackTone = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            }
            fallbackTone.startTone(ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, 15000);
        } catch (Exception ex) {
            Log.e(TAG, "Tone fallback failed: " + ex.getMessage());
        }
    }

    public static synchronized void stopSiren(Context context) {
        if (!isPlaying) return;
        isPlaying = false;
        LogManager.info("SECURITY", "🔇 آژیر خطر ضدسرقت خاموش و متوقف گردید.");

        // Stop sound synthesis thread
        if (sirenThread != null) {
            sirenThread.interrupt();
            sirenThread = null;
        }

        // Stop fallback tone
        if (fallbackTone != null) {
            try {
                fallbackTone.stopTone();
                fallbackTone.release();
            } catch (Exception ignored) {}
            fallbackTone = null;
        }

        // Stop vibration
        stopVibration(context);

        // Stop flash strobe
        stopFlashStrobe(context);
    }

    private static void forceMaxVolume(Context context) {
        try {
            AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                int[] streams = {
                        AudioManager.STREAM_ALARM,
                        AudioManager.STREAM_MUSIC,
                        AudioManager.STREAM_RING,
                        AudioManager.STREAM_SYSTEM,
                        AudioManager.STREAM_NOTIFICATION
                };
                for (int s : streams) {
                    try {
                        int max = am.getStreamMaxVolume(s);
                        am.setStreamVolume(s, max, 0);
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error forcing max volume: " + e.getMessage());
        }
    }

    private static void startVibration(Context context) {
        try {
            Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                long[] pattern = { 0, 300, 80, 300, 80, 600, 100 }; // Heavy continuous pulsating vibration
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    v.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Vibration failed: " + e.getMessage());
        }
    }

    private static void stopVibration(Context context) {
        try {
            Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                v.cancel();
            }
        } catch (Exception ignored) {}
    }

    private static void startFlashStrobe(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flashThread = new Thread(() -> {
                try {
                    CameraManager cam = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
                    if (cam == null) return;
                    String rearCamId = null;
                    for (String id : cam.getCameraIdList()) {
                        CameraCharacteristics c = cam.getCameraCharacteristics(id);
                        Boolean flashAvailable = c.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                        Integer facing = c.get(CameraCharacteristics.LENS_FACING);
                        if (flashAvailable != null && flashAvailable && facing != null && facing == CameraCharacteristics.LENS_FACING_BACK) {
                            rearCamId = id;
                            break;
                        }
                    }
                    if (rearCamId == null && cam.getCameraIdList().length > 0) {
                        rearCamId = cam.getCameraIdList()[0];
                    }
                    if (rearCamId == null) return;

                    boolean state = false;
                    while (isPlaying) {
                        state = !state;
                        try {
                            cam.setTorchMode(rearCamId, state);
                        } catch (Exception ignored) {}
                        Thread.sleep(120); // Fast strobe 8 times per second
                    }
                    try {
                        cam.setTorchMode(rearCamId, false);
                    } catch (Exception ignored) {}
                } catch (Exception ignored) {}
            });
            flashThread.setPriority(Thread.MIN_PRIORITY);
            flashThread.start();
        }
    }

    private static void stopFlashStrobe(Context context) {
        if (flashThread != null) {
            flashThread.interrupt();
            flashThread = null;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                CameraManager cam = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
                if (cam != null) {
                    for (String id : cam.getCameraIdList()) {
                        try {
                            cam.setTorchMode(id, false);
                        } catch (Exception ignored) {}
                    }
                }
            } catch (Exception ignored) {}
        }
    }
}
