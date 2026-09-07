package com.afg.fleetgps.agent;

import android.os.Handler;
import android.os.Looper;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Thread-safe live diagnostic log manager for tracking & monitoring.
 */
public class LogManager {
    public enum Level {
        INFO,
        SUCCESS,
        WARNING,
        ERROR
    }

    public static class LogEntry {
        public final String time;
        public final String tag;
        public final String message;
        public final Level level;

        public LogEntry(String tag, String message, Level level) {
            SimpleDateFormat sdf = new SimpleDateFormat("HH:mm:ss", Locale.getDefault());
            this.time = sdf.format(new Date());
            this.tag = tag;
            this.message = message;
            this.level = level;
        }

        public String formatLine() {
            String prefix;
            switch (level) {
                case SUCCESS:
                    prefix = "[✓]";
                    break;
                case WARNING:
                    prefix = "[!]";
                    break;
                case ERROR:
                    prefix = "[✗]";
                    break;
                case INFO:
                default:
                    prefix = "[i]";
                    break;
            }
            return String.format(Locale.getDefault(), "%s %s [%s] %s", prefix, time, tag, message);
        }
    }

    public interface LogListener {
        void onLogAdded(LogEntry entry);
        void onLogsCleared();
    }

    private static final int MAX_LOGS = 150;
    private static final List<LogEntry> logs = Collections.synchronizedList(new ArrayList<>());
    private static final List<LogListener> listeners = Collections.synchronizedList(new ArrayList<>());
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    public static void log(String tag, String message, Level level) {
        LogEntry entry = new LogEntry(tag, message, level);
        synchronized (logs) {
            if (logs.size() >= MAX_LOGS) {
                logs.remove(0);
            }
            logs.add(entry);
        }

        mainHandler.post(() -> {
            synchronized (listeners) {
                for (LogListener l : listeners) {
                    try {
                        l.onLogAdded(entry);
                    } catch (Exception ignored) {}
                }
            }
        });
    }

    public static void info(String tag, String message) {
        log(tag, message, Level.INFO);
    }

    public static void success(String tag, String message) {
        log(tag, message, Level.SUCCESS);
    }

    public static void warning(String tag, String message) {
        log(tag, message, Level.WARNING);
    }

    public static void error(String tag, String message) {
        log(tag, message, Level.ERROR);
    }

    public static List<LogEntry> getLogs() {
        synchronized (logs) {
            return new ArrayList<>(logs);
        }
    }

    public static String getAllLogsAsText() {
        return getFilteredLogsAsText("ALL");
    }

    public static String getFilteredLogsAsText(String category) {
        StringBuilder sb = new StringBuilder();
        synchronized (logs) {
            for (LogEntry e : logs) {
                if (category == null || category.equalsIgnoreCase("ALL")) {
                    sb.append(e.formatLine()).append("\n");
                } else if (category.equalsIgnoreCase("LOCATION") &&
                        (e.tag.equalsIgnoreCase("GPS") || e.tag.equalsIgnoreCase("LOCATION") || e.tag.equalsIgnoreCase("HEARTBEAT"))) {
                    sb.append(e.formatLine()).append("\n");
                } else if (category.equalsIgnoreCase("NETWORK") &&
                        (e.tag.equalsIgnoreCase("DATABASE") || e.tag.equalsIgnoreCase("SUPABASE") || e.tag.equalsIgnoreCase("NETWORK") || e.tag.equalsIgnoreCase("CONFIG") || e.tag.equalsIgnoreCase("TEST"))) {
                    sb.append(e.formatLine()).append("\n");
                }
            }
        }
        return sb.toString();
    }

    public static void clear() {
        synchronized (logs) {
            logs.clear();
        }
        mainHandler.post(() -> {
            synchronized (listeners) {
                for (LogListener l : listeners) {
                    try {
                        l.onLogsCleared();
                    } catch (Exception ignored) {}
                }
            }
        });
    }

    public static void addListener(LogListener listener) {
        if (listener != null && !listeners.contains(listener)) {
            listeners.add(listener);
        }
    }

    public static void removeListener(LogListener listener) {
        listeners.remove(listener);
    }
}
