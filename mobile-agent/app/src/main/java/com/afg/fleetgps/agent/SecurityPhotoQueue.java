package com.afg.fleetgps.agent;

import android.content.Context;
import android.util.Log;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * SecurityPhotoQueue
 * Manages reliable, non-duplicate offline persistence and automatic upload
 * of intruder security photographs.
 * 
 * Guarantees:
 *  1. If online, uploads immediately and leaves 0 bytes on disk.
 *  2. If offline, stores securely in the private app sandbox.
 *  3. Once uploaded to Supabase (HTTP 200/201), the local file is instantly destroyed (No duplicates).
 *  4. Strict maximum quota of 30 pending photos to safeguard device storage.
 */
public class SecurityPhotoQueue {
    private static final String TAG = "SecurityPhotoQueue";
    private static final String DIR_NAME = "security_vault";
    private static final int MAX_OFFLINE_FILES = 30;
    private static final AtomicBoolean isFlushing = new AtomicBoolean(false);

    /**
     * Enqueue or immediately dispatch an intruder security photo.
     */
    public static void enqueueOrDispatch(Context context, String eventType, String photoBase64, double lat, double lng, String newSim) {
        if (context == null || photoBase64 == null || photoBase64.isEmpty()) return;

        new Thread(() -> {
            boolean uploaded = false;
            // 1. Try immediate dispatch if network is likely active
            try {
                uploaded = ApiClient.sendSecurityEvent(context, eventType, newSim, photoBase64, lat, lng);
            } catch (Exception ex) {
                Log.w(TAG, "Direct upload failed, saving to offline vault: " + ex.getMessage());
            }

            if (uploaded) {
                LogManager.success("SECURITY", "📸 تصویر چهره متجاوز با موفقیت به سرور ابری ارسال شد (" + eventType + ").");
                // Trigger background flush of any previously queued photos
                flushPendingPhotos(context);
                return;
            }

            // 2. Network unavailable - Persist to local private vault
            try {
                File dir = context.getDir(DIR_NAME, Context.MODE_PRIVATE);
                if (!dir.exists()) dir.mkdirs();

                // Enforce max offline quota
                pruneExcessFiles(dir);

                long now = System.currentTimeMillis();
                File photoFile = new File(dir, "sec_snap_" + now + ".json");

                JSONObject json = new JSONObject();
                json.put("event_type", eventType);
                json.put("photo_base64", photoBase64);
                json.put("lat", lat);
                json.put("lng", lng);
                json.put("new_sim", newSim);
                json.put("timestamp", now);

                try (FileOutputStream fos = new FileOutputStream(photoFile)) {
                    fos.write(json.toString().getBytes(StandardCharsets.UTF_8));
                }

                LogManager.warning("SECURITY", "📸 عکس چهره سارق در صف آفلاین ذخیره شد (به محض اتصال به اینترنت پمپاژ می‌شود).");
            } catch (Exception e) {
                Log.e(TAG, "Failed writing to security vault: " + e.getMessage());
            }
        }).start();
    }

    /**
     * Flushes all offline pending photos to Supabase and destroys local copies upon success.
     */
    public static void flushPendingPhotos(Context context) {
        if (context == null) return;
        if (!isFlushing.compareAndSet(false, true)) return;

        new Thread(() -> {
            try {
                File dir = context.getDir(DIR_NAME, Context.MODE_PRIVATE);
                if (!dir.exists()) return;

                File[] files = dir.listFiles((d, name) -> name.startsWith("sec_snap_") && name.endsWith(".json"));
                if (files == null || files.length == 0) return;

                // Sort oldest first
                Arrays.sort(files, Comparator.comparingLong(File::lastModified));

                for (File f : files) {
                    try {
                        int length = (int) f.length();
                        byte[] bytes = new byte[length];
                        try (FileInputStream fis = new FileInputStream(f)) {
                            int read = fis.read(bytes);
                            if (read <= 0) {
                                f.delete();
                                continue;
                            }
                        }

                        JSONObject json = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
                        String eventType = json.optString("event_type", "offline_intruder");
                        String photoBase64 = json.optString("photo_base64", null);
                        double lat = json.optDouble("lat", 0.0);
                        double lng = json.optDouble("lng", 0.0);
                        String newSim = json.optString("new_sim", null);

                        if (photoBase64 == null || photoBase64.isEmpty()) {
                            f.delete();
                            continue;
                        }

                        boolean success = ApiClient.sendSecurityEvent(context, eventType, newSim, photoBase64, lat, lng);
                        if (success) {
                            // CRITICAL: Delete local copy immediately to prevent duplicate sends
                            boolean deleted = f.delete();
                            LogManager.success("SECURITY", "📸 تصویر معلق آفلاین سارق با موفقیت به سوپابیس منتقل و از حافظه گوشی پاک شد.");
                            Log.d(TAG, "Pending photo uploaded and deleted: " + f.getName() + ", deleted=" + deleted);
                        } else {
                            // Internet still unavailable, stop loop and wait for next connection event
                            break;
                        }
                    } catch (Exception ex) {
                        Log.e(TAG, "Error processing queued photo file " + f.getName() + ": " + ex.getMessage());
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error in flushPendingPhotos: " + e.getMessage());
            } finally {
                isFlushing.set(false);
            }
        }).start();
    }

    private static void pruneExcessFiles(File dir) {
        try {
            File[] files = dir.listFiles((d, name) -> name.startsWith("sec_snap_") && name.endsWith(".json"));
            if (files != null && files.length >= MAX_OFFLINE_FILES) {
                Arrays.sort(files, Comparator.comparingLong(File::lastModified));
                int toRemove = files.length - MAX_OFFLINE_FILES + 1;
                for (int i = 0; i < toRemove; i++) {
                    files[i].delete();
                }
            }
        } catch (Exception ignored) {}
    }
}
