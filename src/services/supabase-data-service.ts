/**
 * Supabase Unified Data Service
 * Reads and manages Devices, Vehicles, Geofences, Alerts, and Realtime Subscriptions directly with Supabase.
 */
import { supabase, DbDevice, DbVehicle, DbTelemetry, DbAlert } from '../lib/supabase';

export class SupabaseDataService {
  /**
   * Fetch all devices (or filter by organization/created_by)
   */
  public async getDevices(): Promise<DbDevice[]> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Supabase Data] getDevices error:', error.message);
        return [];
      }
      return (data as DbDevice[]) || [];
    } catch {
      return [];
    }
  }

  /**
   * Register a new GPS Hardware Device
   */
  public async createDevice(device: {
    imei: string;
    model_name?: string;
    protocol?: string;
    sim_number?: string;
    sim_operator?: string;
    created_by?: string;
  }): Promise<{ device: DbDevice | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .insert({
          imei: device.imei.trim(),
          model_name: device.model_name || 'Concox GT06 / WeTrack2',
          protocol: device.protocol || 'GT06',
          sim_number: device.sim_number || '',
          sim_operator: device.sim_operator || 'Roshan',
          created_by: device.created_by,
          status: 'offline',
        })
        .select()
        .single();

      if (error) {
        return {
          device: null,
          error: error.message.includes('unique constraint')
            ? 'دستگاهی با این کد IMEI قبلاً ثبت شده است'
            : error.message,
        };
      }

      return { device: data as DbDevice, error: null };
    } catch (e: any) {
      return { device: null, error: e.message || 'خطا در ثبت دستگاه ردیاب' };
    }
  }

  /**
   * Fetch Vehicles (If ownerId provided, only fetch vehicles belonging to that client)
   */
  public async getVehicles(ownerId?: string): Promise<DbVehicle[]> {
    try {
      let query = supabase
        .from('vehicles')
        .select('*, owner:profiles!vehicles_owner_id_fkey(id, full_name, username, phone), device:devices!vehicles_device_id_fkey(id, imei, model_name, status, last_online)')
        .order('created_at', { ascending: false });

      if (ownerId) {
        query = query.eq('owner_id', ownerId);
      }

      const { data, error } = await query;
      if (error) {
        // Fallback without deep joins if foreign key aliases differ
        const { data: fallbackData } = await supabase
          .from('vehicles')
          .select('*')
          .order('created_at', { ascending: false });
        return (fallbackData as DbVehicle[]) || [];
      }

      return (data as DbVehicle[]) || [];
    } catch {
      return [];
    }
  }

  /**
   * Create / Register a new Vehicle and assign to Client and GPS Device
   */
  public async createVehicle(params: {
    name: string;
    plate_number: string;
    vehicle_type: string;
    owner_id?: string;
    device_id?: string;
    driver_name?: string;
    driver_phone?: string;
    fuel_capacity?: number;
    max_speed_limit?: number;
    created_by?: string;
  }): Promise<{ vehicle: DbVehicle | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          name: params.name.trim(),
          plate_number: params.plate_number.trim(),
          vehicle_type: params.vehicle_type || 'car',
          owner_id: params.owner_id || null,
          device_id: params.device_id || null,
          driver_name: params.driver_name || '',
          driver_phone: params.driver_phone || '',
          fuel_capacity: params.fuel_capacity || 60,
          max_speed_limit: params.max_speed_limit || 100,
          created_by: params.created_by || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return { vehicle: null, error: error.message };
      }

      return { vehicle: data as DbVehicle, error: null };
    } catch (e: any) {
      return { vehicle: null, error: e.message || 'خطا در ثبت موتر' };
    }
  }

  /**
   * Fetch latest telemetry position for a device / vehicle
   */
  public async getLatestTelemetry(imei: string): Promise<DbTelemetry | null> {
    try {
      const { data, error } = await supabase
        .from('gps_telemetry')
        .select('*')
        .eq('device_imei', imei)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return data as DbTelemetry;
    } catch {
      return null;
    }
  }

  /**
   * Fetch route history for replay
   */
  public async getRouteHistory(imei: string, fromDate?: string, toDate?: string): Promise<DbTelemetry[]> {
    try {
      let query = supabase
        .from('gps_telemetry')
        .select('*')
        .eq('device_imei', imei)
        .order('recorded_at', { ascending: true })
        .limit(500);

      if (fromDate) query = query.gte('recorded_at', fromDate);
      if (toDate) query = query.lte('recorded_at', toDate);

      const { data, error } = await query;
      if (error) return [];
      return (data as DbTelemetry[]) || [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch active Alerts
   */
  public async getAlerts(): Promise<DbAlert[]> {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) return [];
      return (data as DbAlert[]) || [];
    } catch {
      return [];
    }
  }
}

export const globalSupabaseDataService = new SupabaseDataService();
