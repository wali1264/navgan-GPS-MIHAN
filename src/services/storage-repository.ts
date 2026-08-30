/**
 * Storage & Database Repository Layer
 * Implements multi-tenant data storage, entity queries, and indexing.
 * Prepared with clean schemas compatible with PostgreSQL + PostGIS & Supabase.
 */
import {
  Organization,
  User,
  Customer,
  Driver,
  Device,
  Vehicle,
  VehicleCurrentState,
  PositionRecord,
  Trip,
  VehicleStop,
  Geofence,
  FleetEvent,
  AlertRule,
  DeviceCommand,
  MaintenanceRecord,
  AuditLog
} from '../shared/types/models.js';
import {
  UserRole,
  VehicleStatus,
  VehicleType,
  EventType,
  EventSeverity,
  CommandStatus,
  CommandType,
  ProtocolType,
  GeofenceType
} from '../shared/types/enums.js';

export class StorageRepository {
  private organizations: Map<string, Organization> = new Map();
  private users: Map<string, User> = new Map();
  private customers: Map<string, Customer> = new Map();
  private drivers: Map<string, Driver> = new Map();
  private devices: Map<string, Device> = new Map();
  private imeiToDeviceId: Map<string, string> = new Map();
  private vehicles: Map<string, Vehicle> = new Map();
  private currentStates: Map<string, VehicleCurrentState> = new Map();
  private positions: PositionRecord[] = []; // In-memory capped history
  private trips: Map<string, Trip> = new Map();
  private stops: Map<string, VehicleStop> = new Map();
  private geofences: Map<string, Geofence> = new Map();
  private events: FleetEvent[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private commands: Map<string, DeviceCommand> = new Map();
  private maintenance: Map<string, MaintenanceRecord> = new Map();
  private auditLogs: AuditLog[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData(): void {
    const orgId = 'org-afg-01';
    const org: Organization = {
      id: orgId,
      name: 'سامانه ردیابی ملی افغانستان (AfgGps)',
      code: 'AFG-GPS-KBL',
      contactEmail: 'ops@afggps.af',
      contactPhone: '+93700123456',
      country: 'افغانستان',
      city: 'کابل',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(orgId, org);

    // Primary System Administrator Account
    const adminUser: User = {
      id: 'usr-admin-01',
      organizationId: orgId,
      email: 'admin@afggps.af',
      fullName: 'مدیر ارشد سامانه (Admin)',
      phone: '+93799112233',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.users.set(adminUser.id, adminUser);

    // Initial system audit log
    this.auditLogs.push({
      id: `audit-${Date.now()}`,
      organizationId: orgId,
      userId: adminUser.id,
      userName: adminUser.fullName,
      action: 'SYSTEM_BOOT',
      targetType: 'SERVER',
      targetId: 'srv-kbl-01',
      timestamp: new Date().toISOString(),
      details: { message: 'GPS Telemetry Gateway initialized cleanly with 0 mock records.' },
    });
  }

  // --- CRUD & Tenant-Aware Methods ---

  public getVehicles(organizationId: string, customerId?: string): Vehicle[] {
    return Array.from(this.vehicles.values()).filter((v) => {
      if (v.organizationId !== organizationId) return false;
      if (customerId && v.customerId !== customerId) return false;
      return true;
    });
  }

  public getVehicleById(id: string, organizationId: string, customerId?: string): Vehicle | undefined {
    const v = this.vehicles.get(id);
    if (!v || v.organizationId !== organizationId) return undefined;
    if (customerId && v.customerId !== customerId) return undefined;
    return v;
  }

  public saveVehicle(vehicle: Vehicle): void {
    this.vehicles.set(vehicle.id, vehicle);
  }

  public deleteVehicle(id: string): boolean {
    return this.vehicles.delete(id);
  }

  public getDevices(organizationId: string): Device[] {
    return Array.from(this.devices.values()).filter((d) => d.organizationId === organizationId);
  }

  public getDeviceById(id: string): Device | undefined {
    return this.devices.get(id);
  }

  public getDeviceByImei(imei: string): Device | undefined {
    const devId = this.imeiToDeviceId.get(imei);
    return devId ? this.devices.get(devId) : undefined;
  }

  public saveDevice(device: Device): void {
    this.devices.set(device.id, device);
    this.imeiToDeviceId.set(device.imei, device.id);
  }

  public getCustomers(organizationId: string): Customer[] {
    return Array.from(this.customers.values()).filter((c) => c.organizationId === organizationId);
  }

  public getDrivers(organizationId: string, customerId?: string): Driver[] {
    return Array.from(this.drivers.values()).filter((d) => {
      if (d.organizationId !== organizationId) return false;
      if (customerId && d.customerId && d.customerId !== customerId) return false;
      return true;
    });
  }

  public getCurrentStates(organizationId: string, customerId?: string): VehicleCurrentState[] {
    return Array.from(this.currentStates.values()).filter((s) => {
      if (s.organizationId !== organizationId) return false;
      if (customerId && s.customerId !== customerId) return false;
      return true;
    });
  }

  public getCurrentStateByVehicleId(vehicleId: string): VehicleCurrentState | undefined {
    return this.currentStates.get(vehicleId);
  }

  public saveCurrentState(state: VehicleCurrentState): void {
    this.currentStates.set(state.vehicleId, state);
  }

  public addPositionRecord(record: PositionRecord): void {
    this.positions.push(record);
    // Keep max 50,000 in memory buffer for demo/prototype
    if (this.positions.length > 50000) {
      this.positions.shift();
    }
  }

  public getPositionHistory(vehicleId: string, startTime: string, endTime: string, limit = 1000): PositionRecord[] {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    const matches = this.positions.filter((p) => {
      if (p.vehicleId !== vehicleId) return false;
      const ts = new Date(p.timestamp).getTime();
      return ts >= start && ts <= end;
    });

    if (matches.length <= limit) return matches;

    // Route sampling / simplification to avoid sending thousands of redundant points
    const step = Math.ceil(matches.length / limit);
    const sampled: PositionRecord[] = [];
    for (let i = 0; i < matches.length; i += step) {
      sampled.push(matches[i]);
    }
    return sampled;
  }

  public getGeofences(organizationId: string, customerId?: string): Geofence[] {
    return Array.from(this.geofences.values()).filter((g) => {
      if (g.organizationId !== organizationId) return false;
      if (customerId && g.customerId !== customerId) return false;
      return true;
    });
  }

  public saveGeofence(geofence: Geofence): void {
    this.geofences.set(geofence.id, geofence);
  }

  public deleteGeofence(id: string): boolean {
    return this.geofences.delete(id);
  }

  public getEvents(organizationId: string, customerId?: string, limit = 100): FleetEvent[] {
    return this.events
      .filter((e) => {
        if (e.organizationId !== organizationId) return false;
        if (customerId && e.customerId !== customerId) return false;
        return true;
      })
      .slice(-limit)
      .reverse();
  }

  public addEvent(event: FleetEvent): void {
    this.events.push(event);
    if (this.events.length > 5000) {
      this.events.shift();
    }
  }

  public acknowledgeEvent(id: string, userId: string): boolean {
    const ev = this.events.find((e) => e.id === id);
    if (ev) {
      ev.isAcknowledged = true;
      ev.acknowledgedAt = new Date().toISOString();
      ev.acknowledgedBy = userId;
      return true;
    }
    return false;
  }

  public getAlertRules(organizationId: string, customerId?: string): AlertRule[] {
    return Array.from(this.alertRules.values()).filter((r) => {
      if (r.organizationId !== organizationId) return false;
      if (customerId && r.customerId !== customerId) return false;
      return true;
    });
  }

  public saveAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  public deleteAlertRule(id: string): boolean {
    return this.alertRules.delete(id);
  }

  public getCommands(organizationId: string): DeviceCommand[] {
    return Array.from(this.commands.values()).filter((c) => c.organizationId === organizationId);
  }

  public saveCommand(command: DeviceCommand): void {
    this.commands.set(command.id, command);
  }

  public getMaintenanceRecords(organizationId: string, vehicleId?: string): MaintenanceRecord[] {
    return Array.from(this.maintenance.values()).filter((m) => {
      if (m.organizationId !== organizationId) return false;
      if (vehicleId && m.vehicleId !== vehicleId) return false;
      return true;
    });
  }

  public saveMaintenanceRecord(record: MaintenanceRecord): void {
    this.maintenance.set(record.id, record);
  }

  public addAuditLog(log: AuditLog): void {
    this.auditLogs.push(log);
    if (this.auditLogs.length > 5000) {
      this.auditLogs.shift();
    }
  }

  public getAuditLogs(organizationId: string, limit = 100): AuditLog[] {
    return this.auditLogs
      .filter((l) => l.organizationId === organizationId)
      .slice(-limit)
      .reverse();
  }

  public getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public getUserById(id: string): User | undefined {
    return this.users.get(id);
  }
}

export const globalStorageRepository = new StorageRepository();
