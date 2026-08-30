/**
 * Complete REST API Router for Fleet Management Platform
 */
import express, { Response } from 'express';
import { authMiddleware, AuthenticatedRequest, requireRole } from './auth-middleware';
import { globalStorageRepository } from '../services/storage-repository';
import { globalGpsGateway } from '../gateway/gateway-service';
import { globalSessionManager } from '../gateway/session-manager';
import { globalProtocolRegistry } from '../protocols/registry';
import { globalCommandService } from '../services/command-service';
import { UserRole, VehicleType, GeofenceType, EventType, EventSeverity, CommandType } from '../shared/types/enums';

export const apiRouter = express.Router();

apiRouter.use(express.json());
apiRouter.use(authMiddleware);

// --- 1. Health & Readiness ---
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'GPS Fleet Tracking Platform',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

apiRouter.get('/ready', (_req, res) => {
  res.json({
    status: 'ready',
    gateway: 'active',
    database: 'connected',
  });
});

// --- 2. Auth Endpoints ---
apiRouter.get('/auth/me', (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

apiRouter.post('/auth/login', (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;
  const user = globalStorageRepository.getUserByEmail(email || 'admin@afggps.af');
  if (!user) {
    res.status(404).json({ error: 'کاربر یافت نشد' });
    return;
  }
  res.json({ token: `simulated-jwt-${user.id}`, user });
});

// Demo switch role endpoint
apiRouter.post('/auth/switch-role', (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body;
  if (role === UserRole.CUSTOMER) {
    const custUser = globalStorageRepository.getUserById('usr-cust-01');
    res.json({ user: custUser });
  } else {
    const adminUser = globalStorageRepository.getUserById('usr-admin-01');
    res.json({ user: adminUser });
  }
});

// --- 3. Vehicles API ---
apiRouter.get('/vehicles', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const customerId = req.user?.role === UserRole.CUSTOMER ? req.user.customerId : undefined;
  const vehicles = globalStorageRepository.getVehicles(orgId, customerId);
  res.json(vehicles);
});

apiRouter.get('/vehicles/:id', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const customerId = req.user?.role === UserRole.CUSTOMER ? req.user.customerId : undefined;
  const vehicle = globalStorageRepository.getVehicleById(req.params.id, orgId, customerId);
  if (!vehicle) {
    res.status(404).json({ error: 'موتر یافت نشد' });
    return;
  }
  res.json(vehicle);
});

apiRouter.post('/vehicles', requireRole([UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.OPERATOR]), (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const data = req.body;

  const newVehicle = {
    id: `veh-${Date.now()}`,
    organizationId: orgId,
    customerId: data.customerId || 'cust-kbl-logistics',
    deviceId: data.deviceId,
    driverId: data.driverId,
    plateNumber: data.plateNumber || 'کابل 5 - 00000',
    vehicleName: data.vehicleName || 'موتر جدید',
    vehicleType: data.vehicleType || VehicleType.CAR,
    brand: data.brand || 'Toyota',
    model: data.model || 'Corolla',
    year: data.year || 2022,
    color: data.color || 'سفید',
    speedLimit: data.speedLimit || 100,
    odometer: data.odometer || 0,
    status: 'ACTIVE' as const,
    createdAt: new Date().toISOString(),
  };

  globalStorageRepository.saveVehicle(newVehicle);
  globalStorageRepository.addAuditLog({
    id: `audit-${Date.now()}`,
    organizationId: orgId,
    userId: req.user!.id,
    userName: req.user!.fullName,
    action: 'CREATE_VEHICLE',
    targetType: 'VEHICLE',
    targetId: newVehicle.id,
    timestamp: new Date().toISOString(),
  });

  res.status(201).json(newVehicle);
});

// --- 4. Current State & Live Positions ---
apiRouter.get('/positions/current', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const customerId = req.user?.role === UserRole.CUSTOMER ? req.user.customerId : undefined;
  const states = globalStorageRepository.getCurrentStates(orgId, customerId);
  res.json(states);
});

// --- 5. Devices API ---
apiRouter.get('/devices', requireRole([UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.OPERATOR]), (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const devices = globalStorageRepository.getDevices(orgId);
  res.json(devices);
});

apiRouter.post('/devices', requireRole([UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]), (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const data = req.body;

  const device = {
    id: `dev-${Date.now()}`,
    organizationId: orgId,
    imei: data.imei,
    protocol: data.protocol,
    model: data.model || 'Universal GPS',
    simNumber: data.simNumber || '',
    simOperator: data.simOperator,
    status: 'ACTIVE' as const,
    assignedVehicleId: data.assignedVehicleId,
    packetCount: 0,
    errorCount: 0,
    createdAt: new Date().toISOString(),
  };

  globalStorageRepository.saveDevice(device);
  res.status(201).json(device);
});

// --- 6. Customers & Drivers API ---
apiRouter.get('/customers', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  res.json(globalStorageRepository.getCustomers(orgId));
});

apiRouter.get('/drivers', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const customerId = req.user?.role === UserRole.CUSTOMER ? req.user.customerId : undefined;
  res.json(globalStorageRepository.getDrivers(orgId, customerId));
});

// --- 7. History & Trip Playback ---
apiRouter.get('/history/:vehicleId', (req: AuthenticatedRequest, res: Response) => {
  const { vehicleId } = req.params;
  const startTime = (req.query.startTime as string) || new Date(Date.now() - 24 * 3600000).toISOString();
  const endTime = (req.query.endTime as string) || new Date().toISOString();
  const limit = parseInt((req.query.limit as string) || '1000', 10);

  const history = globalStorageRepository.getPositionHistory(vehicleId, startTime, endTime, limit);
  res.json(history);
});

// --- 8. Geofences API ---
apiRouter.get('/geofences', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const customerId = req.user?.role === UserRole.CUSTOMER ? req.user.customerId : undefined;
  res.json(globalStorageRepository.getGeofences(orgId, customerId));
});

apiRouter.post('/geofences', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const data = req.body;

  const geofence = {
    id: `geo-${Date.now()}`,
    organizationId: orgId,
    customerId: req.user?.customerId || data.customerId || 'cust-kbl-logistics',
    name: data.name || 'محدوده جدید',
    description: data.description,
    type: data.type || GeofenceType.CIRCLE,
    centerLatitude: data.centerLatitude,
    centerLongitude: data.centerLongitude,
    radiusMeters: data.radiusMeters || 500,
    coordinates: data.coordinates,
    color: data.color || '#06b6d4',
    assignedVehicleIds: data.assignedVehicleIds || [],
    notifyOnEnter: data.notifyOnEnter !== false,
    notifyOnExit: data.notifyOnExit !== false,
    createdAt: new Date().toISOString(),
  };

  globalStorageRepository.saveGeofence(geofence);
  res.status(201).json(geofence);
});

apiRouter.delete('/geofences/:id', (req: AuthenticatedRequest, res: Response) => {
  globalStorageRepository.deleteGeofence(req.params.id);
  res.json({ success: true });
});

// --- 9. Events & Alerts API ---
apiRouter.get('/events', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const customerId = req.user?.role === UserRole.CUSTOMER ? req.user.customerId : undefined;
  res.json(globalStorageRepository.getEvents(orgId, customerId));
});

apiRouter.post('/events/:id/ack', (req: AuthenticatedRequest, res: Response) => {
  const success = globalStorageRepository.acknowledgeEvent(req.params.id, req.user?.id || 'usr-admin-01');
  res.json({ success });
});

apiRouter.get('/alerts/rules', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const customerId = req.user?.role === UserRole.CUSTOMER ? req.user.customerId : undefined;
  res.json(globalStorageRepository.getAlertRules(orgId, customerId));
});

// --- 10. Commands API ---
apiRouter.get('/commands', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  res.json(globalCommandService.getCommands(orgId));
});

apiRouter.post('/commands', async (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const { deviceId, vehicleId, commandType, parameters } = req.body;

  try {
    const cmd = await globalCommandService.sendCommand(
      orgId,
      deviceId,
      vehicleId,
      commandType || CommandType.POSITION_SINGLE,
      parameters || {},
      req.user?.id || 'usr-admin-01'
    );
    res.status(201).json(cmd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

// --- 11. Diagnostics & Gateway Inspection ---
apiRouter.get('/diagnostics/metrics', (_req, res) => {
  const metrics = globalGpsGateway.getMetrics();
  res.json(metrics);
});

apiRouter.get('/diagnostics/sessions', (_req, res) => {
  const sessions = globalSessionManager.getAllSessions();
  res.json(sessions);
});

apiRouter.get('/diagnostics/protocols', (_req, res) => {
  const decoders = globalProtocolRegistry.getAll().map((d) => ({
    protocol: d.protocol,
    defaultPort: d.defaultPort,
    supportedTransports: d.supportedTransports,
  }));
  res.json(decoders);
});

// --- 12. Reports & CSV Export ---
apiRouter.get('/reports/daily', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const customerId = req.user?.role === UserRole.CUSTOMER ? req.user.customerId : undefined;
  const vehicles = globalStorageRepository.getVehicles(orgId, customerId);
  const states = globalStorageRepository.getCurrentStates(orgId, customerId);

  const report = vehicles.map((v) => {
    const s = states.find((st) => st.vehicleId === v.id);
    return {
      vehicleId: v.id,
      plateNumber: v.plateNumber,
      vehicleName: v.vehicleName,
      status: s?.onlineStatus || 'OFFLINE',
      currentSpeed: s?.speed || 0,
      todayDistanceKm: s ? Math.max(0, Math.round(s.speed * 0.2)) : 0,
      maxSpeedKm: s?.speed || 0,
      engineHours: s?.ignition ? '1.0' : '0.0',
      lastAddress: s?.address || 'بدون موقعیت',
    };
  });

  res.json(report);
});

apiRouter.get('/reports/export-csv', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  const customerId = req.user?.role === UserRole.CUSTOMER ? req.user.customerId : undefined;
  const vehicles = globalStorageRepository.getVehicles(orgId, customerId);
  const states = globalStorageRepository.getCurrentStates(orgId, customerId);

  let csv = 'Vehicle ID,Plate Number,Vehicle Name,Status,Speed (km/h),Odometer (km),Address\n';
  for (const v of vehicles) {
    const s = states.find((st) => st.vehicleId === v.id);
    csv += `"${v.id}","${v.plateNumber}","${v.vehicleName}","${s?.onlineStatus || 'OFFLINE'}","${s?.speed || 0}","${s?.odometer || v.odometer}","${s?.address || 'افغانستان'}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="fleet-report.csv"');
  res.send('\uFEFF' + csv); // Include BOM for Persian Excel support
});

// --- 13. Maintenance & Audit Logs ---
apiRouter.get('/maintenance', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  res.json(globalStorageRepository.getMaintenanceRecords(orgId));
});

apiRouter.get('/audit-logs', (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user?.organizationId || 'org-afg-01';
  res.json(globalStorageRepository.getAuditLogs(orgId));
});

