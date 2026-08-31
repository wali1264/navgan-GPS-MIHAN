import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yujovpmltigdtelftvdz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1am92cG1sdGlnZHRlbGZ0dmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODE4NzksImV4cCI6MjEwMzY1Nzg3OX0.YAyi-QEJA4QKL4GePA4S5lH9Pi5TqsYCnehUf795kAI';

export const serverSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    // Inject node ws implementation to prevent Node.js native WebSocket runtime errors
    transport: WebSocket as any,
  },
});

/**
 * Persist incoming GPS decoded telemetry packet to Supabase PostgreSQL database
 */
export async function persistGpsTelemetryToSupabase(payload: {
  imei: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  altitude?: number;
  ignition: boolean;
  batteryLevel?: number;
  gsmSignal?: number;
  satellites?: number;
  rawPacket?: string;
  timestamp?: string;
}) {
  try {
    // 1. Insert into gps_telemetry
    const { error: telemErr } = await serverSupabase.from('gps_telemetry').insert({
      device_imei: payload.imei,
      lat: payload.lat,
      lng: payload.lng,
      speed: Math.round(payload.speed || 0),
      heading: Math.round(payload.heading || 0),
      altitude: Math.round(payload.altitude || 0),
      ignition: Boolean(payload.ignition),
      battery_level: payload.batteryLevel ?? 100,
      gsm_signal: payload.gsmSignal ?? 100,
      satellites: payload.satellites ?? 12,
      raw_packet: payload.rawPacket || '',
      recorded_at: payload.timestamp || new Date().toISOString(),
    });

    if (telemErr) {
      console.warn('[Supabase Telemetry] Insert warning:', telemErr.message);
    }

    // 2. Update device status to online and update last_online timestamp
    await serverSupabase
      .from('devices')
      .update({
        status: 'online',
        last_online: payload.timestamp || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('imei', payload.imei);

  } catch (err) {
    console.error('[Supabase Telemetry] Exception:', err);
  }
}
