/**
 * Main Application Component
 * Integrates real-time WebSocket state updates, Supabase PostgreSQL persistence,
 * unified authentication flow (Admin, Staff, Client), Staff approval workflows,
 * and comprehensive fleet management subsystems.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/common/Header';
import { Sidebar, NavTab } from './components/common/Sidebar';
import { FleetMap } from './components/map/FleetMap';
import { OverviewStats } from './components/dashboard/OverviewStats';
import { VehiclesManager } from './components/vehicles/VehiclesManager';
import { DevicesManager } from './components/devices/DevicesManager';
import { TripHistoryView } from './components/history/TripHistoryView';
import { GeofenceManager } from './components/geofences/GeofenceManager';
import { EventsAlertsView } from './components/events/EventsAlertsView';
import { DiagnosticsView } from './components/diagnostics/DiagnosticsView';
import { CommandsView } from './components/commands/CommandsView';
import { ReportsView } from './components/reports/ReportsView';
import { MaintenanceView } from './components/maintenance/MaintenanceView';
import { CustomersManager } from './components/customers/CustomersManager';
import { DriversManager } from './components/drivers/DriversManager';
import { StaffManager } from './components/staff/StaffManager';
import { CustomerMobileView } from './components/mobile/CustomerMobileView';
import { LoginModal } from './components/auth/LoginModal';
import { StaffRegisterModal } from './components/auth/StaffRegisterModal';
import { PendingApprovalScreen } from './components/auth/PendingApprovalScreen';
import { AuthScreen } from './components/auth/AuthScreen';
import { ChangePasswordModal } from './components/auth/ChangePasswordModal';
import { UserRole, VehicleStatus, CommandType, EventType, EventSeverity, CommandStatus } from './shared/types/enums';
import { Vehicle, Device, Customer, Driver, VehicleCurrentState, Geofence, FleetEvent, DeviceCommand, User, PositionRecord } from './shared/types/models';
import { supabase, UserProfile } from './lib/supabase';
import { globalAuthService } from './services/auth-service';
import { globalSupabaseDataService } from './services/supabase-data-service';

export function App() {
  // Supabase Authenticated Profile State
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isStaffRegisterOpen, setIsStaffRegisterOpen] = useState<boolean>(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);

  // Fallback User representation for compatibility
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'usr-admin-01',
    organizationId: 'org-afg-01',
    role: UserRole.SUPER_ADMIN,
    fullName: 'مدیر ارشد سامانه',
    email: 'admin@afggps.af',
    status: 'ACTIVE',
  });

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileView, setIsMobileView] = useState<boolean>(false);

  // Core Data Collections
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [currentStates, setCurrentStates] = useState<VehicleCurrentState[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [events, setEvents] = useState<FleetEvent[]>([]);
  const [commands, setCommands] = useState<DeviceCommand[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | undefined>(undefined);

  // Check Supabase Auth Session on Mount
  const refreshUserProfile = useCallback(async () => {
    try {
      const profile = await globalAuthService.getActiveUserProfile();
      setCurrentProfile(profile);

      if (profile) {
        // Map to internal user
        const mappedRole =
          profile.role === 'super_admin'
            ? UserRole.SUPER_ADMIN
            : profile.role === 'staff'
            ? UserRole.OPERATOR
            : UserRole.CUSTOMER;

        setCurrentUser({
          id: profile.id,
          organizationId: 'org-afg-01',
          role: mappedRole,
          fullName: profile.full_name,
          email: profile.email || `${profile.username}@navgan.af`,
          status: profile.status === 'approved' ? 'ACTIVE' : 'INACTIVE',
          customerId: profile.role === 'client' ? profile.id : undefined,
        });

        // Switch to mobile client view if role is client
        if (profile.role === 'client') {
          setIsMobileView(true);
        }
      }
    } catch (e) {
      console.warn('[App] Auth refresh exception:', e);
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    refreshUserProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        refreshUserProfile();
      } else {
        setCurrentProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshUserProfile]);

  // Fetch datasets directly from Supabase Centralized Database
  const fetchAllData = useCallback(async () => {
    try {
      const [vList, dList, cList, gList, eList] = await Promise.all([
        globalSupabaseDataService.getVehicles(),
        globalSupabaseDataService.getDevices(),
        globalSupabaseDataService.getCustomers(),
        globalSupabaseDataService.getGeofences(),
        globalSupabaseDataService.getAlerts(),
      ]);

      setVehicles(vList);
      setDevices(dList);
      setCustomers(cList);
      setGeofences(gList);
      setEvents(eList);

      const states = await globalSupabaseDataService.getCurrentStates(vList, dList);
      if (states.length > 0) {
        setCurrentStates(states);
      }
    } catch (err) {
      console.warn('[App] Supabase fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 8000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Supabase Realtime & Live GPS Stream Subscription
  useEffect(() => {
      // 1. Supabase Postgres Realtime for instant multi-device GPS telemetry synchronization
    const channel = supabase
      .channel('afg_gps_live_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gps_telemetry' },
        (payload: any) => {
          const t = payload.new;
          if (!t) return;

          setDevices((prevDevs) => {
            const dev = prevDevs.find((d) => d.imei === t.device_imei);
            
            setVehicles((prevVehs) => {
              // Match vehicle by device ID or directly if only 1 vehicle exists
              const veh = prevVehs.find((v) => (dev && v.deviceId === dev.id) || prevVehs.length === 1);
              if (veh) {
                setCurrentStates((prevStates) => {
                  const newState: VehicleCurrentState = {
                    vehicleId: veh.id,
                    deviceId: dev?.id || veh.deviceId || 'dev-001',
                    customerId: veh.customerId || '',
                    organizationId: 'org-afg-01',
                    latitude: Number(t.lat),
                    longitude: Number(t.lng),
                    altitude: Number(t.altitude || 1790),
                    speed: Math.round(Number(t.speed || 0)),
                    heading: Math.round(Number(t.heading || 0)),
                    ignition: Boolean(t.ignition),
                    door: Boolean(t.door_status),
                    batteryVoltage: Number(t.external_power_voltage || 13.8),
                    batteryPercentage: Number(t.battery_level || 95),
                    gsmSignal: Number(t.gsm_signal || 90),
                    satellites: Number(t.satellites || 12),
                    gpsValid: true,
                    onlineStatus: (Number(t.speed) || 0) > 2 ? VehicleStatus.MOVING : VehicleStatus.STOPPED,
                    lastSeenAt: t.recorded_at || t.created_at || new Date().toISOString(),
                    lastPositionAt: t.recorded_at || t.created_at || new Date().toISOString(),
                    odometer: 0,
                    address: `کابل (${Number(t.lat).toFixed(4)}, ${Number(t.lng).toFixed(4)})`,
                  };

                  const idx = prevStates.findIndex((s) => s.vehicleId === veh.id);
                  if (idx >= 0) {
                    const updated = [...prevStates];
                    updated[idx] = newState;
                    return updated;
                  }
                  return [...prevStates, newState];
                });
              }
              return prevVehs;
            });
            return prevDevs;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles' },
        () => {
          fetchAllData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        () => {
          fetchAllData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload: any) => {
          const a = payload.new;
          if (a) {
            setEvents((prev) => [
              {
                id: a.id,
                organizationId: 'org-afg-01',
                vehicleId: a.vehicle_id || '',
                deviceId: a.device_imei || '',
                eventType: EventType.OVERSPEED,
                severity: EventSeverity.WARNING,
                title: a.title,
                message: a.description || a.title,
                timestamp: a.created_at,
                latitude: a.lat || 34.5553,
                longitude: a.lng || 69.2075,
                speed: a.speed || 0,
                isAcknowledged: a.is_read || false,
              },
              ...prev,
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllData]);

  // Handlers
  const handleSwitchRole = async (role: UserRole) => {
    setCurrentUser((prev) => ({
      ...prev,
      role,
    }));
  };

  const handleLogout = async () => {
    await globalAuthService.signOut();
    setCurrentProfile(null);
    setCurrentUser({
      id: 'usr-admin-01',
      organizationId: 'org-afg-01',
      role: UserRole.SUPER_ADMIN,
      fullName: 'مدیر ارشد سامانه',
      email: 'admin@afggps.af',
      status: 'ACTIVE',
    });
    setIsMobileView(false);
  };

  const handleAddVehicle = async (vehData: Partial<Vehicle>) => {
    try {
      const { vehicle, error } = await globalSupabaseDataService.createVehicle({
        plateNumber: vehData.plateNumber || '',
        vehicleName: vehData.vehicleName || '',
        vehicleType: vehData.vehicleType,
        deviceId: vehData.deviceId,
        customerId: vehData.customerId,
        speedLimit: vehData.speedLimit,
        created_by: currentProfile?.id,
      });

      if (vehicle) {
        setVehicles((prev) => [vehicle, ...prev]);
        fetchAllData();
        return { success: true };
      } else {
        console.warn('[App] Create vehicle error:', error);
        return { success: false, error: error || 'خطا در ثبت موتر' };
      }
    } catch (err: any) {
      console.warn('[App] Create vehicle exception:', err);
      return { success: false, error: err.message || 'خطا در ثبت موتر' };
    }
  };

  const handleAddDevice = async (deviceData: Partial<Device>) => {
    try {
      const { device, error } = await globalSupabaseDataService.createDevice({
        imei: deviceData.imei || '',
        model_name: deviceData.model,
        protocol: deviceData.protocol,
        sim_number: deviceData.simNumber,
        sim_operator: deviceData.simOperator,
        created_by: currentProfile?.id,
      });

      if (device) {
        setDevices((prev) => [device, ...prev]);
        fetchAllData();
        return { success: true };
      } else {
        console.warn('[App] Create device error:', error);
        return { success: false, error: error || 'خطا در ثبت دستگاه GPS' };
      }
    } catch (err: any) {
      console.warn('[App] Create device exception:', err);
      return { success: false, error: err.message || 'خطا در ثبت دستگاه GPS' };
    }
  };

  const handleAddGeofence = async (gfData: Partial<Geofence>) => {
    try {
      const newGf = await globalSupabaseDataService.createGeofence(gfData, currentProfile?.id);
      if (newGf) {
        setGeofences((prev) => [newGf, ...prev]);
      }
    } catch (err) {
      console.warn('[App] Create geofence error:', err);
    }
  };

  const handleDeleteGeofence = async (id: string) => {
    try {
      const ok = await globalSupabaseDataService.deleteGeofence(id);
      if (ok) {
        setGeofences((prev) => prev.filter((g) => g.id !== id));
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleAcknowledgeEvent = async (eventId: string) => {
    try {
      await globalSupabaseDataService.acknowledgeAlert(eventId);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, isAcknowledged: true } : e))
      );
    } catch (err) {
      console.warn(err);
    }
  };

  const handleSendCommand = async (
    deviceId: string,
    vehicleId: string,
    commandType: CommandType,
    parameters?: Record<string, unknown>
  ) => {
    // Local state command recording
    const newCmd: DeviceCommand = {
      id: `cmd-${Date.now()}`,
      organizationId: 'org-afg-01',
      deviceId,
      vehicleId,
      commandType,
      parameters: parameters || {},
      status: CommandStatus.SENT,
      sentAt: new Date().toISOString(),
      createdById: currentProfile?.id || 'usr-admin-01',
      createdAt: new Date().toISOString(),
    };
    setCommands((prev) => [newCmd, ...prev]);
  };

  const handleLoadHistory = async (
    vehicleId: string,
    startTime: string,
    endTime: string
  ): Promise<PositionRecord[]> => {
    const targetVehicle = vehicles.find((v) => v.id === vehicleId);
    if (!targetVehicle) return [];
    return await globalSupabaseDataService.getRouteHistory(targetVehicle, devices, startTime, endTime);
  };

  const activeAlertsCount = events.filter((e) => !e.isAcknowledged).length;

  // Filtered vehicles & states for current view
  const displayedStates = statusFilter
    ? currentStates.filter((s) => s.onlineStatus === statusFilter)
    : currentStates;

  // 1. Initial Authentication Check Loader
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#F4F7F9] flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto shadow-xs text-white">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">در حال بررسی احراز هویت...</h3>
            <p className="text-xs text-slate-500 mt-1">اتصال به سامانه ملی ردیابی ناوگان GPS</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. If user is NOT logged in, show AuthScreen full screen (system is locked)
  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-[#F4F7F9] font-sans" dir="rtl">
        <AuthScreen
          onSuccess={(profile) => {
            setCurrentProfile(profile);
            refreshUserProfile();
          }}
          onOpenStaffRegister={() => setIsStaffRegisterOpen(true)}
        />

        {/* Staff Register Modal (accessible from AuthScreen for admins/staff) */}
        <StaffRegisterModal
          isOpen={isStaffRegisterOpen}
          onClose={() => setIsStaffRegisterOpen(false)}
          onSuccess={(profile) => {
            setCurrentProfile(profile);
            refreshUserProfile();
          }}
          onOpenLogin={() => setIsStaffRegisterOpen(false)}
        />
      </div>
    );
  }

  // 3. If user is logged in with pending or suspended status, block and display pending status screen
  if (currentProfile.status === 'pending' || currentProfile.status === 'suspended') {
    return (
      <PendingApprovalScreen
        profile={currentProfile}
        onRefreshProfile={refreshUserProfile}
        onLogout={handleLogout}
      />
    );
  }

  // 4. Vehicle scoping for clients
  const clientVehicles = currentProfile.role === 'client'
    ? vehicles.filter(
        (v) =>
          v.customerId === currentProfile.id ||
          (v as any).owner_id === currentProfile.id ||
          (v as any).user_id === currentProfile.id
      )
    : vehicles;

  const clientVehicleIds = new Set(clientVehicles.map((v) => v.id));
  const clientStates = currentProfile.role === 'client'
    ? currentStates.filter((s) => clientVehicleIds.has(s.vehicleId))
    : currentStates;

  // 5. Render Customer Mobile Experience if toggled or if client role
  if (isMobileView || currentProfile.role === 'client') {
    return (
      <div className="relative font-sans" dir="rtl">
        <CustomerMobileView
          currentUser={currentUser}
          vehicles={clientVehicles.length > 0 ? clientVehicles : vehicles}
          currentStates={clientStates.length > 0 ? clientStates : currentStates}
          events={events}
          onSelectVehicle={(id) => {
            setSelectedVehicleId(id);
          }}
          selectedVehicleId={selectedVehicleId}
          onChangePassword={() => setIsChangePasswordOpen(true)}
          onLogout={handleLogout}
          onLoadHistory={handleLoadHistory}
        />
        {/* Toggle back button for admin / staff testing */}
        {currentProfile.role !== 'client' && (
          <div className="fixed bottom-4 left-4 z-50">
            <button
              onClick={() => setIsMobileView(false)}
              className="px-3.5 py-1.5 bg-slate-900 text-white rounded-full text-xs font-semibold shadow-lg hover:bg-slate-800 transition cursor-pointer"
            >
              ← بازگشت به پنل مدیریت
            </button>
          </div>
        )}

        {/* Change Password Modal */}
        {currentProfile && (
          <ChangePasswordModal
            isOpen={isChangePasswordOpen}
            onClose={() => setIsChangePasswordOpen(false)}
            currentProfile={currentProfile}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white" dir="rtl">
      {/* Header */}
      <Header
        currentUser={currentUser}
        currentProfile={currentProfile}
        onSwitchRole={handleSwitchRole}
        activeAlertsCount={activeAlertsCount}
        onRefresh={fetchAllData}
        isMobileView={isMobileView}
        onToggleMobileView={() => setIsMobileView(!isMobileView)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenStaffRegister={() => setIsStaffRegisterOpen(true)}
        onChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main App Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Admin Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'map') setSelectedVehicleId(undefined);
          }}
          userRole={currentUser.role}
          activeVehiclesCount={vehicles.length}
          alertsCount={activeAlertsCount}
        />

        {/* Content View Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">پیشخوان مانیتورینگ و وضعیت ناوگان</h1>
                  <p className="text-slate-500 text-xs mt-1">
                    اتصال فعال به پایگاه داده Supabase PostgreSQL - {new Date().toLocaleTimeString('fa-AF')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('reports')}
                    className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition"
                  >
                    گزارش‌های روزانه
                  </button>
                  <button
                    onClick={() => setActiveTab('vehicles')}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium shadow-xs transition"
                  >
                    ثبت موتر جدید
                  </button>
                </div>
              </div>

              {/* KPIs & Stats */}
              <OverviewStats
                vehicles={vehicles}
                currentStates={currentStates}
                events={events}
                onFilterStatus={(st) => {
                  setStatusFilter(st);
                  setActiveTab('map');
                }}
              />

              {/* Central Interactive Map & Quick Sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 h-[540px] bg-white p-2 rounded-xl border border-slate-100 shadow-xs overflow-hidden">
                  <FleetMap
                    vehicles={vehicles}
                    currentStates={displayedStates}
                    geofences={geofences}
                    selectedVehicleId={selectedVehicleId}
                    onSelectVehicle={(id) => setSelectedVehicleId(id)}
                    className="h-full rounded-lg"
                  />
                </div>

                {/* Live Fleet Quick Sidebar */}
                <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs flex flex-col h-[540px]">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">وضعیت زنده وسایط</h3>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-mono font-bold">
                      {vehicles.length} موتر
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pt-3">
                    {vehicles.map((v) => {
                      const st = currentStates.find((s) => s.vehicleId === v.id);
                      const isSelected = selectedVehicleId === v.id;

                      return (
                        <div
                          key={v.id}
                          onClick={() => setSelectedVehicleId(v.id)}
                          className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-blue-50 border-blue-300 text-blue-950 shadow-xs'
                              : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100/80 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold font-mono text-slate-900">{v.plateNumber}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                st?.onlineStatus === VehicleStatus.MOVING
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : st?.onlineStatus === VehicleStatus.IDLE
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : st?.onlineStatus === VehicleStatus.STOPPED
                                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {st?.onlineStatus === VehicleStatus.MOVING
                                ? 'حرکت'
                                : st?.onlineStatus === VehicleStatus.IDLE
                                ? 'درجا'
                                : st?.onlineStatus === VehicleStatus.STOPPED
                                ? 'پارک'
                                : 'آفلاین'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center justify-between">
                            <span>سرعت: <strong className="text-slate-800 font-mono">{st?.speed || 0}</strong> km/h</span>
                            <span className="font-medium">{st?.ignition ? '🔑 روشن' : 'خاموش'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE MAP */}
          {activeTab === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">فیلتر وضعیت ناوگان:</span>
                  <button
                    onClick={() => setStatusFilter(undefined)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                      !statusFilter ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    همه ({vehicles.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter(VehicleStatus.MOVING)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                      statusFilter === VehicleStatus.MOVING
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    حرکت
                  </button>
                  <button
                    onClick={() => setStatusFilter(VehicleStatus.STOPPED)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                      statusFilter === VehicleStatus.STOPPED
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    توقف
                  </button>
                </div>
              </div>

              <div className="h-[calc(100vh-180px)] bg-white p-2 rounded-xl border border-slate-100 shadow-xs overflow-hidden">
                <FleetMap
                  vehicles={vehicles}
                  currentStates={displayedStates}
                  geofences={geofences}
                  selectedVehicleId={selectedVehicleId}
                  onSelectVehicle={(id) => setSelectedVehicleId(id)}
                  className="h-full rounded-lg"
                />
              </div>
            </div>
          )}

          {/* TAB 3: VEHICLES */}
          {activeTab === 'vehicles' && (
            <VehiclesManager
              vehicles={vehicles}
              currentStates={currentStates}
              devices={devices}
              drivers={drivers}
              customers={customers}
              onAddVehicle={handleAddVehicle}
              onSelectVehicle={(id) => {
                setSelectedVehicleId(id);
                setActiveTab('map');
              }}
            />
          )}

          {/* TAB 4: DEVICES */}
          {activeTab === 'devices' && (
            <DevicesManager
              devices={devices}
              vehicles={vehicles}
              onAddDevice={handleAddDevice}
            />
          )}

          {/* TAB 5: HISTORY & PLAYBACK */}
          {activeTab === 'history' && (
            <TripHistoryView
              vehicles={vehicles}
              onLoadHistory={handleLoadHistory}
            />
          )}

          {/* TAB 6: GEOFENCES */}
          {activeTab === 'geofences' && (
            <GeofenceManager
              geofences={geofences}
              vehicles={vehicles}
              onAddGeofence={handleAddGeofence}
              onDeleteGeofence={handleDeleteGeofence}
            />
          )}

          {/* TAB 7: EVENTS & ALERTS */}
          {activeTab === 'events' && (
            <EventsAlertsView
              events={events}
              vehicles={vehicles}
              onAcknowledge={handleAcknowledgeEvent}
            />
          )}

          {/* TAB 8: REPORTS */}
          {activeTab === 'reports' && (
            <ReportsView
              vehicles={vehicles}
              currentStates={currentStates}
            />
          )}

          {/* TAB 9: DRIVERS */}
          {activeTab === 'drivers' && (
            <DriversManager
              drivers={drivers}
              vehicles={vehicles}
            />
          )}

          {/* TAB 10: CUSTOMERS / CLIENT ONBOARDING */}
          {activeTab === 'customers' && (
            <CustomersManager
              customers={customers}
              vehicles={vehicles}
              currentAdmin={currentProfile || undefined}
            />
          )}

          {/* TAB 11: STAFF MANAGEMENT (SUPER ADMIN ONLY) */}
          {activeTab === 'staff' && (
            <StaffManager
              currentAdmin={currentProfile || {
                id: 'super-admin-01',
                username: 'superadmin',
                full_name: 'مدیر ارشد سامانه',
                role: 'super_admin',
                status: 'approved',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }}
            />
          )}

          {/* TAB 12: COMMANDS */}
          {activeTab === 'commands' && (
            <CommandsView
              vehicles={vehicles}
              devices={devices}
              commands={commands}
              onSendCommand={handleSendCommand}
            />
          )}

          {/* TAB 13: DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <DiagnosticsView />
          )}

          {/* TAB 14: MAINTENANCE */}
          {activeTab === 'maintenance' && (
            <MaintenanceView vehicles={vehicles} />
          )}
        </main>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={(profile) => {
          setCurrentProfile(profile);
          refreshUserProfile();
        }}
        onOpenStaffRegister={() => setIsStaffRegisterOpen(true)}
      />

      {/* Staff Register Modal */}
      <StaffRegisterModal
        isOpen={isStaffRegisterOpen}
        onClose={() => setIsStaffRegisterOpen(false)}
        onSuccess={(profile) => {
          setCurrentProfile(profile);
          refreshUserProfile();
        }}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* Change Password Modal */}
      {currentProfile && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          currentProfile={currentProfile}
        />
      )}
    </div>
  );
}

export default App;
