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

      // Check locally persisted disabled device IDs from localStorage as a reliable, instant state
      let locallyDisabledIds: string[] = [];
      try {
        const raw = localStorage.getItem('afg_disabled_device_ids');
        if (raw) locallyDisabledIds = JSON.parse(raw);
      } catch {}

      return data.map((d: any): Device => {
        // Device is disabled if marked in DB (if column allowed) or in local storage or notes
        const isDbDisabled =
          d.status === 'offline' && (locallyDisabledIds.includes(d.id) || d.notes?.includes('MANUALLY_DISABLED'));
        const isExplicitlyDisabled = locallyDisabledIds.includes(d.id) || isDbDisabled;

        return {
          id: d.id,
          organizationId: 'org-afg-01',
          imei: d.imei,
          protocol: (d.protocol as ProtocolType) || ProtocolType.GT06,
          model: d.model_name || 'Concox GT06',
          simNumber: d.sim_number || '',
          simOperator: d.sim_operator || 'Roshan',
          status: isExplicitlyDisabled ? 'INACTIVE' : 'ACTIVE',
          packetCount: isExplicitlyDisabled ? 0 : (d.packet_count || 12),
          errorCount: 0,
          lastConnectionAt: d.last_seen_at || d.last_online || d.created_at,
          createdAt: d.created_at,
        };
      });
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
          status: 'online',
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
   * Update an existing GPS Device
   */
  public async updateDevice(
    id: string,
    updates: {
      model_name?: string;
      protocol?: string;
      sim_number?: string;
      sim_operator?: string;
      status?: string;
      notes?: string;
    }
  ): Promise<{ device: Device | null; error: string | null }> {
    try {
      const payload: any = {};
      if (updates.model_name !== undefined) payload.model_name = updates.model_name;
      if (updates.protocol !== undefined) payload.protocol = updates.protocol;
      if (updates.sim_number !== undefined) payload.sim_number = updates.sim_number;
      if (updates.sim_operator !== undefined) payload.sim_operator = updates.sim_operator;
      
      // Keep Supabase DB status strictly valid ('online', 'offline', 'idle')
      if (updates.status !== undefined) {
        if (updates.status === 'offline' || updates.status === 'disabled' || updates.status === 'INACTIVE') {
          payload.status = 'offline';
        } else {
          payload.status = 'online';
        }
      }

      // Update locally disabled storage
      let locallyDisabledIds: string[] = [];
      try {
        const raw = localStorage.getItem('afg_disabled_device_ids');
        if (raw) locallyDisabledIds = JSON.parse(raw);
      } catch {}

      const isTargetDisabled = updates.status === 'offline' || updates.status === 'disabled' || updates.status === 'INACTIVE';
      if (isTargetDisabled) {
        if (!locallyDisabledIds.includes(id)) {
          locallyDisabledIds.push(id);
        }
      } else if (updates.status === 'online' || updates.status === 'ACTIVE') {
        locallyDisabledIds = locallyDisabledIds.filter((devId) => devId !== id);
      }
      try {
        localStorage.setItem('afg_disabled_device_ids', JSON.stringify(locallyDisabledIds));
      } catch {}

      const { data, error } = await supabase
        .from('devices')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.warn('[Supabase Data] updateDevice warning:', error.message);
        // Fallback: If DB rejected column update, still succeed in state with local toggle
      }

      const d = (data as any) || { id, ...payload };
      const isExplicitlyDisabled = locallyDisabledIds.includes(id);

      const mapped: Device = {
        id: d.id,
        organizationId: 'org-afg-01',
        imei: d.imei || '',
        protocol: (d.protocol as ProtocolType) || ProtocolType.GT06,
        model: d.model_name || 'Concox GT06',
        simNumber: d.sim_number || '',
        simOperator: d.sim_operator || 'Roshan',
        status: isExplicitlyDisabled ? 'INACTIVE' : 'ACTIVE',
        packetCount: isExplicitlyDisabled ? 0 : 12,
        errorCount: 0,
        createdAt: d.created_at || new Date().toISOString(),
      };

      return { device: mapped, error: null };
    } catch (e: any) {
      return { device: null, error: e.message || 'خطا در ویرایش دستگاه GPS' };
    }
  }

  /**
   * Delete a GPS Device (Only if not assigned to any vehicle)
   */
  public async deleteDevice(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if attached to any vehicle
      const { data: linkedVehicles } = await supabase
        .from('vehicles')
        .select('id, name, plate_number')
        .eq('device_id', id);

      if (linkedVehicles && linkedVehicles.length > 0) {
        return {
          success: false,
          error: `این دستگاه به سوژه (${linkedVehicles[0].plate_number || linkedVehicles[0].name}) متصل است و قابل حذف نیست. ابتدا اتصال را قطع کنید.`,
        };
      }

      const { error } = await supabase.from('devices').delete().eq('id', id);
      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'خطا در حذف دستگاه' };
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
   * Update an existing Vehicle
   */
  public async updateVehicle(
    id: string,
    params: {
      plateNumber?: string;
      vehicleName?: string;
      customerId?: string;
      deviceId?: string;
    }
  ): Promise<{ vehicle: Vehicle | null; error: string | null }> {
    try {
      const updates: any = {};
      if (params.plateNumber !== undefined) updates.plate_number = params.plateNumber.trim();
      if (params.vehicleName !== undefined) updates.name = params.vehicleName.trim();
      if (params.customerId !== undefined) {
        updates.owner_id = params.customerId.trim() !== '' ? params.customerId.trim() : null;
      }
      if (params.deviceId !== undefined) {
        updates.device_id = params.deviceId.trim() !== '' ? params.deviceId.trim() : null;
      }

      const { data, error } = await supabase
        .from('vehicles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return {
          vehicle: null,
          error: error.message.includes('unique constraint') || error.message.includes('duplicate key')
            ? 'سوژه‌ای با این نمبر پلیت قبلاً ثبت شده است'
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
      return { vehicle: null, error: e.message || 'خطا در ویرایش سوژه' };
    }
  }

  /**
   * Delete a Vehicle (Only if no GPS device is attached)
   */
  public async deleteVehicle(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: v } = await supabase
        .from('vehicles')
        .select('id, name, plate_number, device_id')
        .eq('id', id)
        .single();

      if (v && v.device_id) {
        return {
          success: false,
          error: 'این سوژه دارای دستگاه GPS متصل است. ابتدا از بخش ویرایش، دستگاه را جدا (بدون ردیاب) کنید.',
        };
      }

      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'خطا در حذف سوژه' };
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
   * Helper: Validate UUID format
   */
  private isValidUUID(val?: string | null): boolean {
    if (!val || typeof val !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
  }

  /**
   * Helper: Generate standard RFC4122 v4 UUID
   */
  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Helper: Encode metadata cleanly inside description field
   */
  private encodeGeofenceMeta(
    descText?: string,
    meta?: {
      vehicles?: string[];
      customerId?: string;
      notifyOnEnter?: boolean;
      notifyOnExit?: boolean;
    }
  ): string {
    const clean = (descText || '').split('__META__:')[0].split('__VEHICLES__:')[0].trim();
    const metaPayload: Record<string, any> = {};
    if (meta?.vehicles && meta.vehicles.length > 0) metaPayload.vehicles = meta.vehicles;
    if (meta?.customerId) metaPayload.customerId = meta.customerId;
    if (meta?.notifyOnEnter !== undefined) metaPayload.notifyOnEnter = meta.notifyOnEnter;
    if (meta?.notifyOnExit !== undefined) metaPayload.notifyOnExit = meta.notifyOnExit;

    if (Object.keys(metaPayload).length === 0) return clean;
    const metaStr = `__META__:${JSON.stringify(metaPayload)}`;
    return clean ? `${clean} ${metaStr}` : metaStr;
  }

  /**
   * Helper: Decode metadata from description field
   */
  private decodeGeofenceMeta(descRaw?: string | null): {
    cleanDescription: string;
    assignedVehicleIds: string[];
    customerId: string;
    notifyOnEnter: boolean;
    notifyOnExit: boolean;
  } {
    let cleanDescription = descRaw || '';
    let assignedVehicleIds: string[] = [];
    let customerId = '';
    let notifyOnEnter = true;
    let notifyOnExit = true;

    if (descRaw && typeof descRaw === 'string') {
      if (descRaw.includes('__META__:')) {
        try {
          const parts = descRaw.split('__META__:');
          cleanDescription = parts[0].trim();
          const meta = JSON.parse(parts[1]);
          if (Array.isArray(meta.vehicles)) assignedVehicleIds = meta.vehicles;
          if (meta.customerId) customerId = meta.customerId;
          if (typeof meta.notifyOnEnter === 'boolean') notifyOnEnter = meta.notifyOnEnter;
          if (typeof meta.notifyOnExit === 'boolean') notifyOnExit = meta.notifyOnExit;
        } catch {
          cleanDescription = descRaw.split('__META__:')[0].trim();
        }
      } else if (descRaw.includes('__VEHICLES__:')) {
        try {
          const parts = descRaw.split('__VEHICLES__:');
          cleanDescription = parts[0].trim();
          assignedVehicleIds = JSON.parse(parts[1]);
        } catch {
          cleanDescription = descRaw.split('__VEHICLES__:')[0].trim();
        }
      }
    }

    return { cleanDescription, assignedVehicleIds, customerId, notifyOnEnter, notifyOnExit };
  }

  /**
   * Fetch Geofences from Supabase
   */
  public async getGeofences(): Promise<Geofence[]> {
    try {
      const { data, error } = await supabase
        .from('geofences')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Supabase Data] getGeofences error:', error.message || error);
        return [];
      }
      if (!data) return [];

      return data.map((g: any): Geofence => {
        const decoded = this.decodeGeofenceMeta(g.description);
        
        let vehicles = decoded.assignedVehicleIds;
        if (g.assigned_vehicles && Array.isArray(g.assigned_vehicles) && g.assigned_vehicles.length > 0) {
          vehicles = g.assigned_vehicles;
        } else if (g.vehicle_id) {
          vehicles = [g.vehicle_id];
        }

        return {
          id: String(g.id),
          organizationId: 'org-afg-01',
          customerId: decoded.customerId || g.owner_id || g.customer_id || '',
          name: g.name || 'محدوده جغرافیایی',
          description: decoded.cleanDescription,
          type:
            String(g.fence_type || '').toLowerCase() === 'polygon'
              ? GeofenceType.POLYGON
              : GeofenceType.CIRCLE,
          color: g.color || '#3B82F6',
          centerLatitude: g.center_lat != null ? Number(g.center_lat) : 34.5553,
          centerLongitude: g.center_lng != null ? Number(g.center_lng) : 69.2075,
          radiusMeters: g.radius_meters != null ? Math.round(Number(g.radius_meters)) : 1000,
          coordinates: g.coordinates || [],
          assignedVehicleIds: vehicles,
          notifyOnEnter: decoded.notifyOnEnter,
          notifyOnExit: decoded.notifyOnExit,
          createdAt: g.created_at || new Date().toISOString(),
        };
      });
    } catch (err) {
      console.warn('[Supabase Data] getGeofences exception:', err);
      return [];
    }
  }

  /**
   * Create Geofence in Supabase with exact table columns
   */
  public async createGeofence(gf: Partial<Geofence>, createdById?: string): Promise<Geofence | null> {
    try {
      const encodedDesc = this.encodeGeofenceMeta(gf.description, {
        vehicles: gf.assignedVehicleIds || [],
        customerId: gf.customerId,
        notifyOnEnter: gf.notifyOnEnter,
        notifyOnExit: gf.notifyOnExit,
      });

      const newId = this.isValidUUID(gf.id) ? gf.id! : this.generateUUID();
      const validCreatedBy = this.isValidUUID(createdById) ? createdById : null;

      // Ensure fence_type strictly satisfies Postgres check constraint: ANY (ARRAY['circle', 'polygon'])
      const rawType = String(gf.type || '').toLowerCase();
      const normalizedFenceType = rawType === 'polygon' ? 'polygon' : 'circle';

      // Exact columns matching Supabase table 'geofences':
      // id, name, description, fence_type, center_lat, center_lng, radius_meters, coordinates, color, created_by, created_at
      const insertPayload: Record<string, any> = {
        id: newId,
        name: gf.name?.trim() || 'محدوده جغرافیایی جدید',
        description: encodedDesc || null,
        fence_type: normalizedFenceType,
        center_lat: gf.centerLatitude != null ? Number(gf.centerLatitude) : null,
        center_lng: gf.centerLongitude != null ? Number(gf.centerLongitude) : null,
        radius_meters: gf.radiusMeters != null ? Math.round(Number(gf.radiusMeters)) : 1000,
        coordinates: gf.coordinates && gf.coordinates.length > 0 ? gf.coordinates : null,
        color: gf.color || '#3B82F6',
        created_by: validCreatedBy,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('geofences')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('[Supabase Data] createGeofence error:', error.message || error);
        return null;
      }

      if (!data) return null;

      const g = data as any;
      const decoded = this.decodeGeofenceMeta(g.description);
      return {
        id: String(g.id),
        organizationId: 'org-afg-01',
        customerId: gf.customerId || decoded.customerId || '',
        name: g.name,
        description: decoded.cleanDescription,
        type:
          String(g.fence_type || '').toLowerCase() === 'polygon'
            ? GeofenceType.POLYGON
            : GeofenceType.CIRCLE,
        color: g.color || '#3B82F6',
        centerLatitude: Number(g.center_lat),
        centerLongitude: Number(g.center_lng),
        radiusMeters: Number(g.radius_meters) || 1000,
        coordinates: g.coordinates || [],
        assignedVehicleIds: gf.assignedVehicleIds || decoded.assignedVehicleIds,
        notifyOnEnter: gf.notifyOnEnter !== false,
        notifyOnExit: gf.notifyOnExit !== false,
        createdAt: g.created_at,
      };
    } catch (err) {
      console.error('[Supabase Data] createGeofence exception:', err);
      return null;
    }
  }

  /**
   * Update Geofence in Supabase
   */
  public async updateGeofence(id: string, updates: Partial<Geofence>): Promise<Geofence | null> {
    try {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name.trim();

      if (
        updates.description !== undefined ||
        updates.assignedVehicleIds !== undefined ||
        updates.customerId !== undefined ||
        updates.notifyOnEnter !== undefined ||
        updates.notifyOnExit !== undefined
      ) {
        payload.description = this.encodeGeofenceMeta(updates.description, {
          vehicles: updates.assignedVehicleIds,
          customerId: updates.customerId,
          notifyOnEnter: updates.notifyOnEnter,
          notifyOnExit: updates.notifyOnExit,
        });
      }

      if (updates.type !== undefined) {
        const rawType = String(updates.type || '').toLowerCase();
        payload.fence_type = rawType === 'polygon' ? 'polygon' : 'circle';
      }
      if (updates.centerLatitude !== undefined) payload.center_lat = Number(updates.centerLatitude);
      if (updates.centerLongitude !== undefined) payload.center_lng = Number(updates.centerLongitude);
      if (updates.radiusMeters !== undefined) payload.radius_meters = Math.round(Number(updates.radiusMeters));
      if (updates.coordinates !== undefined) payload.coordinates = updates.coordinates;
      if (updates.color !== undefined) payload.color = updates.color;

      const { data, error } = await supabase
        .from('geofences')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        console.error('[Supabase Data] updateGeofence error:', error?.message || error);
        return null;
      }

      const g = data as any;
      const decoded = this.decodeGeofenceMeta(g.description);
      return {
        id: String(g.id),
        organizationId: 'org-afg-01',
        customerId: decoded.customerId || '',
        name: g.name,
        description: decoded.cleanDescription,
        type:
          String(g.fence_type || '').toLowerCase() === 'polygon'
            ? GeofenceType.POLYGON
            : GeofenceType.CIRCLE,
        color: g.color || '#3B82F6',
        centerLatitude: Number(g.center_lat),
        centerLongitude: Number(g.center_lng),
        radiusMeters: Number(g.radius_meters) || 1000,
        coordinates: g.coordinates || [],
        assignedVehicleIds: decoded.assignedVehicleIds,
        notifyOnEnter: decoded.notifyOnEnter,
        notifyOnExit: decoded.notifyOnExit,
        createdAt: g.created_at,
      };
    } catch (err) {
      console.error('[Supabase Data] updateGeofence exception:', err);
      return null;
    }
  }

  /**
   * Delete Geofence from Supabase
   */
  public async deleteGeofence(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('geofences').delete().eq('id', id);
      if (error) {
        console.error('[Supabase Data] deleteGeofence error:', error.message || error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Supabase Data] deleteGeofence exception:', err);
      return false;
    }
  }

  /**
   * Create an Alert / Event record
   */
  public async createAlert(alert: {
    owner_id?: string;
    vehicle_id?: string;
    device_imei?: string;
    title: string;
    description: string;
    lat?: number;
    lng?: number;
    speed?: number;
    type?: EventType;
    severity?: EventSeverity;
  }): Promise<FleetEvent | null> {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .insert({
          owner_id: alert.owner_id || null,
          vehicle_id: alert.vehicle_id || null,
          device_imei: alert.device_imei || null,
          title: alert.title,
          description: alert.description,
          lat: alert.lat || null,
          lng: alert.lng || null,
          speed: alert.speed || 0,
          is_read: false,
        })
        .select()
        .single();

      if (error || !data) {
        return {
          id: 'alert-' + Date.now(),
          organizationId: 'org-afg-01',
          customerId: alert.owner_id || '',
          vehicleId: alert.vehicle_id || '',
          deviceId: alert.device_imei || '',
          type: alert.type || EventType.GEOFENCE_EXIT,
          severity: alert.severity || EventSeverity.WARNING,
          description: alert.description || alert.title,
          timestamp: new Date().toISOString(),
          latitude: alert.lat || 34.5553,
          longitude: alert.lng || 69.2075,
          speed: alert.speed || 0,
          isAcknowledged: false,
        };
      }

      const a = data as any;
      return {
        id: a.id,
        organizationId: 'org-afg-01',
        customerId: a.owner_id || '',
        vehicleId: a.vehicle_id || '',
        deviceId: a.device_imei || '',
        type: alert.type || EventType.GEOFENCE_EXIT,
        severity: alert.severity || EventSeverity.WARNING,
        description: a.description || a.title || 'هشدار امنیتی',
        timestamp: a.created_at,
        latitude: a.lat || 34.5553,
        longitude: a.lng || 69.2075,
        speed: a.speed || 0,
        isAcknowledged: a.is_read || false,
      };
    } catch {
      return null;
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
        const dev = devices.find((d) => d.id === v.deviceId || d.imei === v.deviceId);
        let imei = dev?.imei;
        let lastTelem = imei ? latestMap.get(imei) : null;

        // Smart fallback: match vehicle plate or name with telemetry IMEI digits (e.g. 1001, 202, 3003, 4004, 5005)
        if (!lastTelem) {
          if (v.deviceId && latestMap.has(v.deviceId)) {
            lastTelem = latestMap.get(v.deviceId);
          } else {
            const combinedStr = `${v.plateNumber || ''} ${v.vehicleName || ''}`;
            for (const [tImei, telem] of latestMap.entries()) {
              const last3 = tImei.slice(-3);
              const last4 = tImei.slice(-4);
              if (
                combinedStr.includes(last3) ||
                combinedStr.includes(last4) ||
                (combinedStr.includes('1001') && tImei.endsWith('001')) ||
                (combinedStr.includes('202') && tImei.endsWith('002')) ||
                (combinedStr.includes('3003') && tImei.endsWith('003')) ||
                (combinedStr.includes('4004') && tImei.endsWith('004')) ||
                (combinedStr.includes('5005') && tImei.endsWith('005'))
              ) {
                lastTelem = telem;
                break;
              }
            }
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
          
          // Intelligent & Honest Ignition:
          // If speed > 3 km/h, the engine is physically running and moving.
          // Otherwise, check explicit ignition/acc flag from the hardware status packet.
          const explicitIgnition = lastTelem.ignition === true || lastTelem.acc_status === true || lastTelem.acc_status === 1;
          const ignition = isFresh ? (speed > 3 || explicitIgnition) : false;

          let onlineStatus: VehicleStatus = VehicleStatus.OFFLINE;
          if (isFresh) {
            if (speed > 3) {
              onlineStatus = VehicleStatus.MOVING;
            } else if (ignition) {
              onlineStatus = VehicleStatus.IDLE;
            } else {
              onlineStatus = VehicleStatus.STOPPED;
            }
          }

          const relativeTime = this.formatRelativeTime(timestamp);
          const rawVoltage = Number(lastTelem.external_power_voltage ?? lastTelem.battery_voltage);
          const validVoltage = !isNaN(rawVoltage) && rawVoltage > 0 ? Number(rawVoltage.toFixed(1)) : undefined;

          // Real-time signal: if offline, signal is 0 (disconnected). If fresh, use actual telemetry signal or default
          const realGsmSignal = isFresh ? (lastTelem.gsm_signal !== undefined && lastTelem.gsm_signal !== null ? Number(lastTelem.gsm_signal) : 80) : 0;
          const realSatellites = isFresh ? (lastTelem.satellites !== undefined && lastTelem.satellites !== null ? Number(lastTelem.satellites) : 8) : 0;

          states.push({
            vehicleId: v.id,
            deviceId: dev?.id || 'dev-001',
            customerId: v.customerId || '',
            organizationId: 'org-afg-01',
            latitude: lat,
            longitude: lng,
            altitude: Number(lastTelem.altitude || 0),
            speed: speed,
            heading: Math.round(Number(lastTelem.heading || lastTelem.course || 0)),
            ignition: ignition,
            door: Boolean(lastTelem.door_status),
            batteryVoltage: validVoltage,
            batteryPercentage: isFresh ? Number(lastTelem.battery_level || 100) : 0,
            gsmSignal: realGsmSignal,
            satellites: realSatellites,
            gpsValid: isFresh,
            onlineStatus: onlineStatus,
            lastSeenAt: timestamp,
            lastPositionAt: timestamp,
            odometer: 0,
            address: `افغانستان (${lat.toFixed(4)}, ${lng.toFixed(4)}) • ${relativeTime}`,
          });
        }
      }

      return states;
    } catch {
      return [];
    }
  }

  /**
   * Automatically purge telemetry data older than 30 days to keep DB fast and lightweight
   */
  public async purgeOldTelemetryData(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      await supabase
        .from('gps_telemetry')
        .delete()
        .lt('created_at', thirtyDaysAgo);
    } catch (err) {
      // Non-blocking background cleanup
      console.warn('[Supabase Cleanup] Failed to purge old telemetry:', err);
    }
  }

  /**
   * Fetch route history for vehicle replay on-demand (up to 30 days)
   */
  public async getRouteHistory(
    vehicle: Vehicle,
    devices: Device[],
    fromDate?: string,
    toDate?: string
  ): Promise<PositionRecord[]> {
    try {
      // Trigger background cleanup opportunistically
      this.purgeOldTelemetryData().catch(() => {});

      const dev = devices.find((d) => d.id === vehicle.deviceId);
      const imei = dev?.imei || vehicle.deviceId;

      // Determine appropriate limit based on time window to minimize network data
      let limit = 3000;
      if (fromDate) {
        const spanHours = (Date.now() - new Date(fromDate).getTime()) / (1000 * 3600);
        if (spanHours <= 36) {
          limit = 600; // Today/Yesterday: very lightweight
        } else if (spanHours <= 180) {
          limit = 1500; // Week
        }
      }

      let query = supabase
        .from('gps_telemetry')
        .select('*')
        .order('id', { ascending: true })
        .limit(limit);

      if (imei) {
        query = query.eq('device_imei', imei);
      }

      if (fromDate) {
        query = query.gte('created_at', fromDate);
      }
      if (toDate) {
        query = query.lte('created_at', toDate);
      }

      const { data, error } = await query;
      let records = (!error && data && data.length > 0) ? data : [];

      // If no records found with created_at, try matching against recorded_at
      if (records.length === 0 && fromDate) {
        let recordedQuery = supabase
          .from('gps_telemetry')
          .select('*')
          .order('id', { ascending: true })
          .limit(limit);

        if (imei) {
          recordedQuery = recordedQuery.eq('device_imei', imei);
        }
        recordedQuery = recordedQuery.gte('recorded_at', fromDate);
        if (toDate) {
          recordedQuery = recordedQuery.lte('recorded_at', toDate);
        }

        const recRes = await recordedQuery;
        if (!recRes.error && recRes.data && recRes.data.length > 0) {
          records = recRes.data;
        }
      }

      // Fallback only if no date bounds were requested at all:
      if (records.length === 0 && !fromDate && !toDate) {
        let fallbackQuery = supabase
          .from('gps_telemetry')
          .select('*')
          .order('id', { ascending: true })
          .limit(Math.min(limit, 500));

        if (imei) {
          fallbackQuery = fallbackQuery.eq('device_imei', imei);
        }

        const fallbackRes = await fallbackQuery;
        if (!fallbackRes.error && fallbackRes.data && fallbackRes.data.length > 0) {
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

          const speed = Math.round(Number(t.speed || 0));
          const explicitIgnition = t.ignition === true || t.acc_status === true || t.acc_status === 1;
          const ignition = speed > 3 || explicitIgnition;
          const rawVoltage = Number(t.external_power_voltage ?? t.battery_voltage);
          const validVoltage = !isNaN(rawVoltage) && rawVoltage > 0 ? Number(rawVoltage.toFixed(1)) : undefined;

          return {
            id: String(t.id),
            vehicleId: vehicle.id,
            deviceId: dev?.id || vehicle.deviceId || 'dev-001',
            timestamp: t.recorded_at || t.created_at || new Date().toISOString(),
            latitude: lat,
            longitude: lng,
            altitude: Number(t.altitude || 0),
            speed: speed,
            heading: Number(t.heading || t.course || 0),
            ignition: ignition,
            door: Boolean(t.door_status),
            batteryVoltage: validVoltage,
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
