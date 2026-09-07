package com.afg.fleetgps.agent;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.TotalCaptureResult;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.util.Base64;
import android.util.Log;
import android.util.Size;

import androidx.annotation.NonNull;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * HiddenCameraManager
 * Performs silent, headless, front-facing camera capture using Android Camera2 API.
 * Captures the intruder's portrait without opening any UI, flashing the screen, or making shutter sounds.
 * Automatically compresses image to high-efficiency Base64 JPEG (35-50KB) and delivers to SecurityPhotoQueue.
 */
public class HiddenCameraManager {
    private static final String TAG = "HiddenCameraManager";
    private static final AtomicBoolean isCapturing = new AtomicBoolean(false);
    private static long lastCaptureTime = 0;

    /**
     * Triggers silent front camera capture with rate-limiting protection.
     */
    public static void captureIntruderPhoto(Context context, String eventType, double lat, double lng) {
        captureIntruderPhoto(context, eventType, lat, lng, null);
    }

    public static void captureIntruderPhoto(Context context, String eventType, double lat, double lng, String newSim) {
        if (context == null) return;

        // Prevent hammering: minimum 4 seconds between triggers
        long now = System.currentTimeMillis();
        if (now - lastCaptureTime < 4000) {
            Log.d(TAG, "Capture throttled (too soon after last capture)");
            return;
        }

        if (!isCapturing.compareAndSet(false, true)) {
            Log.w(TAG, "Camera capture is already in progress");
            return;
        }

        lastCaptureTime = now;
        LogManager.info("SECURITY", "📸 شلیک مخفی به دوربین سلفی در پس‌زمینه (علت: " + eventType + ")...");

        HandlerThread bgThread = new HandlerThread("CameraBackgroundThread");
        bgThread.start();
        Handler bgHandler = new Handler(bgThread.getLooper());

        bgHandler.post(() -> {
            try {
                executeCameraCapture(context, eventType, lat, lng, newSim, bgThread, bgHandler);
            } catch (Exception e) {
                Log.e(TAG, "Error executing camera capture: " + e.getMessage());
                safeCleanup(null, null, null, bgThread);
            }
        });

        // Failsafe watchdog timer: forcibly release after 8 seconds
        new Handler(context.getMainLooper()).postDelayed(() -> {
            if (isCapturing.get()) {
                Log.w(TAG, "Camera capture watchdog timeout reached. Releasing lock.");
                isCapturing.set(false);
            }
        }, 8000);
    }

    @SuppressLint("MissingPermission")
    private static void executeCameraCapture(Context context, String eventType, double lat, double lng,
                                             String newSim, HandlerThread bgThread, Handler bgHandler) {
        CameraManager manager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
        if (manager == null) {
            safeCleanup(null, null, null, bgThread);
            return;
        }

        try {
            String frontCameraId = null;
            Size chosenSize = new Size(640, 480); // Default VGA

            for (String id : manager.getCameraIdList()) {
                CameraCharacteristics chars = manager.getCameraCharacteristics(id);
                Integer facing = chars.get(CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT) {
                    frontCameraId = id;
                    StreamConfigurationMap map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
                    if (map != null) {
                        Size[] outputSizes = map.getOutputSizes(ImageFormat.JPEG);
                        if (outputSizes != null) {
                            for (Size s : outputSizes) {
                                // Prefer 640x480 or closest compact resolution
                                if (s.getWidth() == 640 && s.getHeight() == 480) {
                                    chosenSize = s;
                                    break;
                                } else if (s.getWidth() <= 800 && s.getHeight() <= 600) {
                                    chosenSize = s;
                                }
                            }
                        }
                    }
                    break;
                }
            }

            // Fallback to any camera if front camera not found
            if (frontCameraId == null && manager.getCameraIdList().length > 0) {
                frontCameraId = manager.getCameraIdList()[0];
            }

            if (frontCameraId == null) {
                Log.e(TAG, "No camera device available");
                safeCleanup(null, null, null, bgThread);
                return;
            }

            final String camId = frontCameraId;
            final ImageReader imageReader = ImageReader.newInstance(
                    chosenSize.getWidth(),
                    chosenSize.getHeight(),
                    ImageFormat.JPEG,
                    2
            );

            imageReader.setOnImageAvailableListener(reader -> {
                Image image = null;
                try {
                    image = reader.acquireLatestImage();
                    if (image != null) {
                        ByteBuffer buffer = image.getPlanes()[0].getBuffer();
                        byte[] bytes = new byte[buffer.remaining()];
                        buffer.get(bytes);

                        // Compress and optimize JPEG
                        String base64Image = compressAndEncode(bytes);
                        if (base64Image != null) {
                            // Queue for dispatch to Supabase
                            SecurityPhotoQueue.enqueueOrDispatch(context, eventType, base64Image, lat, lng, newSim);
                        }
                    }
                } catch (Exception ex) {
                    Log.e(TAG, "Error reading captured frame: " + ex.getMessage());
                } finally {
                    if (image != null) {
                        image.close();
                    }
                }
            }, bgHandler);

            manager.openCamera(camId, new CameraDevice.StateCallback() {
                @Override
                public void onOpened(@NonNull CameraDevice camera) {
                    try {
                        camera.createCaptureSession(
                                Collections.singletonList(imageReader.getSurface()),
                                new CameraCaptureSession.StateCallback() {
                                    @Override
                                    public void onConfigured(@NonNull CameraCaptureSession session) {
                                        try {
                                            CaptureRequest.Builder builder = camera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE);
                                            builder.addTarget(imageReader.getSurface());
                                            builder.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE);
                                            builder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON);

                                            // Take first portrait photo
                                            session.capture(builder.build(), new CameraCaptureSession.CaptureCallback() {
                                                @Override
                                                public void onCaptureCompleted(@NonNull CameraCaptureSession sess,
                                                                               @NonNull CaptureRequest request,
                                                                               @NonNull TotalCaptureResult result) {
                                                    // Allow 400ms then take a secondary confirmation frame to guard against blinks
                                                    bgHandler.postDelayed(() -> {
                                                        try {
                                                            sess.capture(builder.build(), null, bgHandler);
                                                        } catch (Exception ignored) {}

                                                        // Close and clean up after 700ms
                                                        bgHandler.postDelayed(() -> {
                                                            safeCleanup(camera, session, imageReader, bgThread);
                                                        }, 700);
                                                    }, 350);
                                                }
                                            }, bgHandler);
                                        } catch (Exception e) {
                                            Log.e(TAG, "Failed to start capture request: " + e.getMessage());
                                            safeCleanup(camera, session, imageReader, bgThread);
                                        }
                                    }

                                    @Override
                                    public void onConfigureFailed(@NonNull CameraCaptureSession session) {
                                        Log.e(TAG, "Camera capture session configuration failed");
                                        safeCleanup(camera, session, imageReader, bgThread);
                                    }
                                },
                                bgHandler
                        );
                    } catch (Exception e) {
                        Log.e(TAG, "createCaptureSession failed: " + e.getMessage());
                        safeCleanup(camera, null, imageReader, bgThread);
                    }
                }

                @Override
                public void onDisconnected(@NonNull CameraDevice camera) {
                    safeCleanup(camera, null, imageReader, bgThread);
                }

                @Override
                public void onError(@NonNull CameraDevice camera, int error) {
                    Log.e(TAG, "Camera device error: " + error);
                    safeCleanup(camera, null, imageReader, bgThread);
                }
            }, bgHandler);

        } catch (Exception e) {
            Log.e(TAG, "executeCameraCapture failed: " + e.getMessage());
            safeCleanup(null, null, null, bgThread);
        }
    }

    /**
     * Compresses the JPEG byte array to ~35-50KB with clear facial fidelity.
     */
    private static String compressAndEncode(byte[] rawJpegBytes) {
        try {
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inPreferredConfig = Bitmap.Config.RGB_565;
            Bitmap bitmap = BitmapFactory.decodeByteArray(rawJpegBytes, 0, rawJpegBytes.length, opts);
            if (bitmap == null) return null;

            // Scale down if still too large
            if (bitmap.getWidth() > 800 || bitmap.getHeight() > 800) {
                float ratio = Math.min(640f / bitmap.getWidth(), 640f / bitmap.getHeight());
                int targetW = Math.round(bitmap.getWidth() * ratio);
                int targetH = Math.round(bitmap.getHeight() * ratio);
                bitmap = Bitmap.createScaledBitmap(bitmap, targetW, targetH, true);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 65, baos);
            byte[] compressed = baos.toByteArray();
            bitmap.recycle();

            Log.d(TAG, "Intruder photo compressed size: " + compressed.length + " bytes");
            return "data:image/jpeg;base64," + Base64.encodeToString(compressed, Base64.NO_WRAP);
        } catch (Exception e) {
            Log.e(TAG, "Compression error: " + e.getMessage());
            return null;
        }
    }

    private static void safeCleanup(CameraDevice camera, CameraCaptureSession session, ImageReader reader, HandlerThread thread) {
        try {
            if (session != null) {
                try { session.close(); } catch (Exception ignored) {}
            }
            if (camera != null) {
                try { camera.close(); } catch (Exception ignored) {}
            }
            if (reader != null) {
                try { reader.close(); } catch (Exception ignored) {}
            }
            if (thread != null) {
                thread.quitSafely();
            }
        } finally {
            isCapturing.set(false);
        }
    }
}
