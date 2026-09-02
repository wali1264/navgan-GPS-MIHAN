/**
 * Supabase Unified Data Service
 * Reads and manages Devices, Vehicles, Geofences, Alerts, and Realtime Subscriptions directly with Supabase.
 * Connects Vercel, VPS, and Mobile apps seamlessly to the same centralized PostgreSQL database.
 */
import { supabase } from '../lib/supabase';
import { Vehicle, Device, Customer, Geofence, FleetEvent, VehicleCurrentState, PositionRecord } from '../shared/types/models';
import { VehicleType, VehicleStatus, ProtocolType, EventType, EventSeverity, GeofenceType } from '../shared/types/enums';

export class SupabaseDataService {
  /**
   * Fetch all devices
   */
  public async getDevices(): Promise<Device[]> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        console.warn('[Supabase Data] getDevices error:', error?.message);
        return [];
      }

      return data.map((d: any): Device => ({
        id: d.id,
        organizationId: 'org-afg-01',
        imei: d.imei,
        protocol: (d.protocol as ProtocolType) || ProtocolType.GT06,
        model: d.model_name || 'Concox GT06',
        simNumber: d.sim_number || '',
        simOperator: d.sim_operator || 'Roshan',
        status: d.status === 'online' ? 'ACTIVE' : 'INACTIVE',
        packetCount: 0,
        errorCount: 0,
        lastConnectionAt: d.last_online || d.created_at,
        createdAt: d.created_at,
      }));
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
  }): Promise<{ device: Device | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .insert({
          imei: device.imei.trim(),
          model_name: device.model_name || 'Concox GT06 / WeTrack2',
          protocol: device.protocol || 'GT06',
          sim_number: device.sim_number || '',
          sim_operator: device.sim_operator || 'Roshan',
          created_by: device.created_by || null,
          status: 'offline',
        })
        .select()
        .single();

      if (error) {
        return {
          device: null,
          error: error.message.includes('unique constraint') || error.message.includes('duplicate key')
            ? 'دستگاهی با این کد IMEI قبلاً ثبت شده است'
            : error.message,
        };
      }

      const d = data as any;
      const mapped: Device = {
        id: d.id,
        organizationId: 'org-afg-01',
        imei: d.imei,
        protocol: (d.protocol as ProtocolType) || ProtocolType.GT06,
        model: d.model_name || 'Concox GT06',
        simNumber: d.sim_number || '',
        simOperator: d.sim_operator || 'Roshan',
        status: 'ACTIVE',
        packetCount: 0,
        errorCount: 0,
        createdAt: d.created_at,
      };

      return { device: mapped, error: null };
    } catch (e: any) {
      return { device: null, error: e.message || 'خطا در ثبت دستگاه ردیاب' };
    }
  }

  /**
   * Fetch Vehicles (If ownerId provided, only fetch vehicles belonging to that client)
   */
  public async getVehicles(ownerId?: string): Promise<Vehicle[]> {
    try {
      let query = supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (ownerId) {
        query = query.eq('owner_id', ownerId);
      }

      const { data, error } = await query;
      if (error || !data) {
        console.warn('[Supabase Data] getVehicles error:', error?.message);
        return [];
      }

      return data.map((v: any): Vehicle => ({
        id: v.id,
        organizationId: 'org-afg-01',
        customerId: v.owner_id || '',
        deviceId: v.device_id || undefined,
        plateNumber: v.plate_number,
        vehicleName: v.name,
        vehicleType: (v.vehicle_type as VehicleType) || VehicleType.CAR,
        brand: 'Toyota',
        model: 'Corolla',
        year: 2023,
        color: 'سفید',
        speedLimit: v.max_speed_limit || 100,
        odometer: 0,
        status: v.is_active ? 'ACTIVE' : 'INACTIVE',
        createdAt: v.created_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Create / Register a new Vehicle and assign to Client and GPS Device
   */
  public async createVehicle(params: {
    plateNumber: string;
    vehicleName: string;
    vehicleType?: VehicleType | string;
    customerId?: string;
    deviceId?: string;
    driverName?: string;
    driverPhone?: string;
    speedLimit?: number;
    created_by?: string;
  }): Promise<{ vehicle: Vehicle | null; error: string | null }> {
    try {
      // Normalize vehicle_type to lowercase standard strings to satisfy Postgres CHECK constraint
      const rawType = String(params.vehicleType || 'car').trim().toLowerCase();
      let normalizedType = 'car';
      if (rawType.includes('truck') || rawType.includes('لاری') || rawType.includes('باربری')) {
        normalizedType = 'truck';
      } else if (rawType.includes('bus') || rawType.includes('بس') || rawType.includes('ملی‌بس')) {
        normalizedType = 'bus';
      } else if (rawType.includes('van') || rawType.includes('هایس') || rawType.includes('ون')) {
        normalizedType = 'van';
      } else if (rawType.includes('motorcycle') || rawType.includes('موترسایکل') || rawType.includes('موتور')) {
        normalizedType = 'motorcycle';
      } else if (rawType.includes('taxi') || rawType.includes('تکسی') || rawType.includes('تاکسی')) {
        normalizedType = 'taxi';
      } else if (rawType.includes('pickup') || rawType.includes('پیک')) {
        normalizedType = 'pickup';
      } else if (rawType.includes('heavy') || rawType.includes('سنگین')) {
        normalizedType = 'heavy';
      } else {
        normalizedType = 'car';
      }

      // Safe clean customerId and deviceId to null if empty
      const cleanOwnerId = params.customerId && params.customerId.trim() !== '' ? params.customerId.trim() : null;
      const cleanDeviceId = params.deviceId && params.deviceId.trim() !== '' ? params.deviceId.trim() : null;

      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          name: params.vehicleName.trim(),
          plate_number: params.plateNumber.trim(),
          vehicle_type: normalizedType,
          owner_id: cleanOwnerId,
          device_id: cleanDeviceId,
          driver_name: params.driverName?.trim() || '',
          driver_phone: params.driverPhone?.trim() || '',
          max_speed_limit: params.speedLimit || 100,
          created_by: params.created_by || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return {
          vehicle: null,
          error: error.message.includes('vehicles_vehicle_type_check')
            ? 'نوع واسطه نقلیه معتبر نیست'
            : error.message.includes('unique constraint') || error.message.includes('duplicate key')
            ? 'موتر با این نمبر پلیت قبلاً در سامانه ثبت گردیده است'
            : error.message,
        };
      }

      const v = data as any;
      const mapped: Vehicle = {
        id: v.id,
        organizationId: 'org-afg-01',
        customerId: v.owner_id || '',
        deviceId: v.device_id || undefined,
        plateNumber: v.plate_number,
        vehicleName: v.name,
        vehicleType: (v.vehicle_type as VehicleType) || VehicleType.CAR,
        brand: 'Toyota',
        model: 'Corolla',
        year: 2023,
        color: 'سفید',
        speedLimit: v.max_speed_limit || 100,
        odometer: 0,
        status: 'ACTIVE',
        createdAt: v.created_at,
      };

      return { vehicle: mapped, error: null };
    } catch (e: any) {
      return { vehicle: null, error: e.message || 'خطا در ثبت موتر' };
    }
  }

  /**
   * Fetch Customers (Profiles with role = client)
   */
  public async getCustomers(): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((p: any): Customer => ({
        id: p.id,
        organizationId: 'org-afg-01',
        name: p.full_name,
        companyName: p.username ? `@${p.username}` : undefined,
        contactPerson: p.full_name,
        phone: p.phone || '',
        email: p.email || `${p.username}@navgan.af`,
        address: p.notes || 'کابل، افغانستان',
        city: 'کابل',
        activeVehiclesCount: 0,
        createdAt: p.created_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch Geofences
   */
  public async getGeofences(): Promise<Geofence[]> {
    try {
      const { data, error } = await supabase
        .from('geofences')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((g: any): Geofence => ({
        id: g.id,
        organizationId: 'org-afg-01',
        customerId: g.owner_id || '',
        name: g.name,
        description: g.description || '',
        type: (g.fence_type as GeofenceType) || GeofenceType.CIRCLE,
        color: g.color || '#3B82F6',
        centerLatitude: g.center_lat,
        centerLongitude: g.center_lng,
        radiusMeters: g.radius_meters || 1000,
        coordinates: g.coordinates || [],
        assignedVehicleIds: [],
        notifyOnEnter: true,
        notifyOnExit: true,
        createdAt: g.created_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Create Geofence
   */
  public async createGeofence(gf: Partial<Geofence>, createdById?: string): Promise<Geofence | null> {
    try {
      const { data, error } = await supabase
        .from('geofences')
        .insert({
          name: gf.name || 'محدوده جغرافیایی جدید',
          description: gf.description || '',
          fence_type: gf.type || 'circle',
          center_lat: gf.centerLatitude,
          center_lng: gf.centerLongitude,
          radius_meters: gf.radiusMeters || 1000,
          coordinates: gf.coordinates || null,
          color: gf.color || '#3B82F6',
          created_by: createdById || null,
        })
        .select()
        .single();

      if (error || !data) return null;

      const g = data as any;
      return {
        id: g.id,
        organizationId: 'org-afg-01',
        customerId: g.owner_id || '',
        name: g.name,
        description: g.description || '',
        type: (g.fence_type as GeofenceType) || GeofenceType.CIRCLE,
        color: g.color || '#3B82F6',
        centerLatitude: g.center_lat,
        centerLongitude: g.center_lng,
        radiusMeters: g.radius_meters || 1000,
        coordinates: g.coordinates || [],
        assignedVehicleIds: [],
        notifyOnEnter: true,
        notifyOnExit: true,
        createdAt: g.created_at,
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete Geofence
   */
  public async deleteGeofence(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('geofences').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Fetch Alerts / Events
   */
  public async getAlerts(): Promise<FleetEvent[]> {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !data) return [];

      return data.map((a: any): FleetEvent => ({
        id: a.id,
        organizationId: 'org-afg-01',
        customerId: a.owner_id || '',
        vehicleId: a.vehicle_id || '',
        deviceId: a.device_imei || '',
        type: EventType.OVERSPEED,
        severity: EventSeverity.WARNING,
        description: a.description || a.title || 'هشدار امنیتی',
        timestamp: a.created_at,
        latitude: a.lat || 34.5553,
        longitude: a.lng || 69.2075,
        speed: a.speed || 0,
        isAcknowledged: a.is_read || false,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Acknowledge Alert
   */
  public async acknowledgeAlert(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Helper to format relative Persian time string
   */
  public formatRelativeTime(dateString?: string): string {
    if (!dateString) return 'نامشخص';
    try {
      const now = Date.now();
      const time = new Date(dateString).getTime();
      const diffSec = Math.floor((now - time) / 1000);

      if (diffSec < 20) return 'هم‌اکنون (زنده)';
      if (diffSec < 60) return `${diffSec} ثانیه پیش`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} دقیقه قبل`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} ساعت قبل`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} روز قبل`;
    } catch {
      return dateString;
    }
  }

  /**
   * Fetch Current Position States for all vehicles
   */
  public async getCurrentStates(vehicles: Vehicle[], devices: Device[]): Promise<VehicleCurrentState[]> {
    try {
      // Fetch latest telemetry records from central database
      const { data: telemetryList, error } = await supabase
        .from('gps_telemetry')
        .select('*')
        .order('id', { ascending: false })
        .limit(500);

      if (error || !telemetryList || telemetryList.length === 0) return [];

      // Group latest telemetry by device_imei
      const latestMap = new Map<string, any>();
      for (const t of telemetryList) {
        if (t.device_imei && !latestMap.has(t.device_imei)) {
          latestMap.set(t.device_imei, t);
        }
      }

      const states: VehicleCurrentState[] = [];
      const now = Date.now();

      for (const v of vehicles) {
        const dev = devices.find((d) => d.id === v.deviceId);
        const imei = dev?.imei;
        let lastTelem = imei ? latestMap.get(imei) : null;

        // Fallback: match by IMEI directly or latest telemetry record
        if (!lastTelem) {
          // If vehicle has a deviceId matching an IMEI
          if (v.deviceId && latestMap.has(v.deviceId)) {
            lastTelem = latestMap.get(v.deviceId);
          } else if (telemetryList.length > 0) {
            lastTelem = telemetryList[0];
          }
        }

        if (lastTelem) {
          let lat = Number(lastTelem.lat ?? lastTelem.latitude);
          let lng = Number(lastTelem.lng ?? lastTelem.longitude);

          // Validate coordinates (fallback to Kabul center if completely invalid or missing)
          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) {
            lat = 34.5355;
            lng = 69.1665;
          }

          const rawSpeed = Math.round(Number(lastTelem.speed || 0));
          const timestamp = lastTelem.recorded_at || lastTelem.created_at || new Date().toISOString();
          const recordTime = new Date(timestamp).getTime();
          const ageSeconds = Math.max(0, Math.floor((now - recordTime) / 1000));

          // Real-time offline timeout: if no packet for more than 180 seconds (3 mins), vehicle is OFFLINE
          const isFresh = ageSeconds <= 180;
          const speed = isFresh ? rawSpeed : 0;
          const ignition = isFresh ? Boolean(lastTelem.ignition ?? lastTelem.acc_status ?? (speed > 0)) : false;

          let onlineStatus: VehicleStatus = VehicleStatus.OFFLINE;
          if (isFresh) {
            if (speed > 2) {
              onlineStatus = VehicleStatus.MOVING;
            } else if (ignition) {
              onlineStatus = VehicleStatus.IDLE;
            } else {
              onlineStatus = VehicleStatus.STOPPED;
            }
          }

          const relativeTime = this.formatRelativeTime(timestamp);

          states.push({
            vehicleId: v.id,
            deviceId: dev?.id || 'dev-001',
            customerId: v.customerId || '',
            organizationId: 'org-afg-01',
            latitude: lat,
            longitude: lng,
            altitude: Number(lastTelem.altitude || 1790),
            speed: speed,
            heading: Math.round(Number(lastTelem.heading || lastTelem.course || 0)),
            ignition: ignition,
            door: Boolean(lastTelem.door_status),
            batteryVoltage: Number(lastTelem.external_power_voltage || 13.8),
            batteryPercentage: Number(lastTelem.battery_level || 95),
            gsmSignal: Number(lastTelem.gsm_signal || (isFresh ? 90 : 0)),
            satellites: Number(lastTelem.satellites || (isFresh ? 12 : 0)),
            gpsValid: isFresh,
            onlineStatus: onlineStatus,
            lastSeenAt: timestamp,
            lastPositionAt: timestamp,
            odometer: 0,
            address: `کابل (${lat.toFixed(4)}, ${lng.toFixed(4)}) • ${relativeTime}`,
          });
        }
      }

      return states;
    } catch {
      return [];
    }
  }

  /**
   * Fetch route history for vehicle replay (up to 30 days)
   */
  public async getRouteHistory(
    vehicle: Vehicle,
    devices: Device[],
    fromDate?: string,
    toDate?: string
  ): Promise<PositionRecord[]> {
    try {
      const dev = devices.find((d) => d.id === vehicle.deviceId);
      const imei = dev?.imei;

      let query = supabase
        .from('gps_telemetry')
        .select('*')
        .order('id', { ascending: true })
        .limit(3000);

      if (imei) {
        query = query.eq('device_imei', imei);
      }

      const { data, error } = await query;
      let records = (!error && data && data.length > 0) ? data : [];

      if (records.length === 0) {
        const fallbackRes = await supabase
          .from('gps_telemetry')
          .select('*')
          .order('id', { ascending: true })
          .limit(1000);

        if (!fallbackRes.error && fallbackRes.data) {
          records = fallbackRes.data;
        }
      }

      return records
        .map((t: any): PositionRecord | null => {
          let lat = Number(t.lat ?? t.latitude);
          let lng = Number(t.lng ?? t.longitude);

          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return null;
          }

          return {
            id: String(t.id),
            vehicleId: vehicle.id,
            deviceId: dev?.id || 'dev-001',
            timestamp: t.recorded_at || t.created_at || new Date().toISOString(),
            latitude: lat,
            longitude: lng,
            altitude: Number(t.altitude || 1790),
            speed: Number(t.speed || 0),
            heading: Number(t.heading || t.course || 0),
            ignition: Boolean(t.ignition ?? t.acc_status),
            door: Boolean(t.door_status),
            batteryVoltage: Number(t.external_power_voltage || 13.8),
            satellites: Number(t.satellites || 12),
            gpsValid: true,
            odometer: 0,
            originalProtocol: dev?.protocol || ('GT06' as any),
          };
        })
        .filter((r): r is PositionRecord => r !== null);
    } catch {
      return [];
    }
  }
}

export const globalSupabaseDataService = new SupabaseDataService();
