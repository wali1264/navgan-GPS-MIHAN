import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://yujovpmltigdtelftvdz.supabase.co';
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1am92cG1sdGlnZHRlbGZ0dmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODE4NzksImV4cCI6MjEwMzY1Nzg3OX0.YAyi-QEJA4QKL4GePA4S5lH9Pi5TqsYCnehUf795kAI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type DbRole = 'super_admin' | 'staff' | 'client';
export type DbStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  phone?: string;
  email?: string;
  role: DbRole;
  status: DbStatus;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DbDevice {
  id: string;
  imei: string;
  model_name: string;
  protocol: string;
  sim_number?: string;
  sim_operator?: string;
  status: 'online' | 'offline' | 'idle';
  last_online?: string;
  subscription_start?: string;
  subscription_end?: string;
  created_by?: string;
  created_at: string;
}

export interface DbVehicle {
  id: string;
  plate_number: string;
  name: string;
  vehicle_type: string;
  owner_id?: string;
  device_id?: string;
  driver_name?: string;
  driver_phone?: string;
  icon?: string;
  is_active: boolean;
  fuel_capacity?: number;
  max_speed_limit?: number;
  created_by?: string;
  created_at: string;
  // Joined relation fields
  owner?: UserProfile;
  device?: DbDevice;
}

export interface DbTelemetry {
  id: number;
  device_imei: string;
  vehicle_id?: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  altitude?: number;
  ignition: boolean;
  battery_level: number;
  gsm_signal?: number;
  satellites?: number;
  raw_packet?: string;
  recorded_at: string;
}

export interface DbAlert {
  id: string;
  device_imei: string;
  vehicle_id?: string;
  alert_type: string;
  title: string;
  description?: string;
  lat?: number;
  lng?: number;
  speed?: number;
  is_read: boolean;
  created_at: string;
}
