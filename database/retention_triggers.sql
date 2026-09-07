-- ==============================================================================
-- AFG GPS Fleet & Mobile Security: Database Triggers and Retention Policies
-- Run this script in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Ensure Table Structure for Mobile Security Events
CREATE TABLE IF NOT EXISTS public.mobile_security_events (
    id BIGSERIAL PRIMARY KEY,
    device_imei VARCHAR(64) NOT NULL,
    vehicle_id UUID NULL,
    event_type VARCHAR(64) NOT NULL, -- 'failed_unlock_3times', 'sim_changed', 'panic_siren', 'screen_on_theft_mode', 'sms_photo'
    photo_url TEXT NULL,            -- Base64 JPEG data or storage URL
    new_sim_number VARCHAR(64) NULL,
    lat DOUBLE PRECISION NULL,
    lng DOUBLE PRECISION NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for high-speed device-specific queries
CREATE INDEX IF NOT EXISTS idx_security_events_imei_created 
ON public.mobile_security_events (device_imei, created_at DESC);

-- 2. Trigger Function: Enforce strict 30-photo maximum per device (FIFO Pruning)
-- Whenever a new photo or security event is inserted, any photos beyond the newest 30
-- for that specific IMEI are automatically deleted immediately.
CREATE OR REPLACE FUNCTION public.prune_device_security_photos_trigger()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.mobile_security_events
    WHERE id IN (
        SELECT id
        FROM public.mobile_security_events
        WHERE device_imei = NEW.device_imei
        ORDER BY created_at DESC
        OFFSET 30
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if already exists to ensure clean idempotent creation
DROP TRIGGER IF EXISTS trg_prune_security_photos ON public.mobile_security_events;

CREATE TRIGGER trg_prune_security_photos
AFTER INSERT ON public.mobile_security_events
FOR EACH ROW
EXECUTE FUNCTION public.prune_device_security_photos_trigger();

-- 3. Maintenance Function: 30-Day Expiration Cleanup
-- Deletes GPS telemetry and mobile security events older than 30 days.
CREATE OR REPLACE FUNCTION public.cleanup_old_gps_and_security_data()
RETURNS VOID AS $$
DECLARE
    cutoff_timestamp TIMESTAMPTZ := NOW() - INTERVAL '30 days';
BEGIN
    -- Delete telemetry older than 30 days
    DELETE FROM public.gps_telemetry
    WHERE created_at < cutoff_timestamp
       OR (recorded_at IS NOT NULL AND recorded_at < (NOW() - INTERVAL '30 days')::text);

    -- Delete security events older than 30 days
    DELETE FROM public.mobile_security_events
    WHERE created_at < cutoff_timestamp;

    -- Delete acknowledged or low priority old alerts
    DELETE FROM public.alerts
    WHERE created_at < cutoff_timestamp;

    RAISE NOTICE 'Cleaned up data older than %', cutoff_timestamp;
END;
$$ LANGUAGE plpgsql;

-- Optional: If pg_cron extension is enabled on Supabase, schedule it daily at 03:00 UTC:
-- SELECT cron.schedule('daily-gps-security-cleanup', '0 3 * * *', 'SELECT public.cleanup_old_gps_and_security_data();');
