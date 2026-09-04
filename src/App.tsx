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
import { CustomerMapFilter } from './components/map/CustomerMapFilter';
import { VehiclesManager } from './components/vehicles/VehiclesManager';
import { DevicesManager } from './components/devices/DevicesManager';
import { TripHistoryView } from './components/history/TripHistoryView';
import { CustomersManager } from './components/customers/CustomersManager';
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

  const [activeTab, setActiveTab] = useState<NavTab>('map');
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
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
    const interval = setInterval(fetchAllData, 4000);
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

          let rawLat = Number(t.lat ?? t.latitude);
          let rawLng = Number(t.lng ?? t.longitude);

          if (isNaN(rawLat) || isNaN(rawLng) || rawLat < -90 || rawLat > 90 || rawLng < -180 || rawLng > 180 || (rawLat === 0 && rawLng === 0)) {
            rawLat = 34.5355;
            rawLng = 69.1665;
          }

          const rawSpeed = Math.round(Number(t.speed || 0));
          const ignition = Boolean(t.ignition ?? t.acc_status ?? (rawSpeed > 0));
          const timestamp = t.recorded_at || t.created_at || new Date().toISOString();

          setDevices((prevDevs) => {
            const dev = prevDevs.find((d) => d.imei === t.device_imei);
            
            setVehicles((prevVehs) => {
              // Match vehicle by device ID or directly if only 1 vehicle exists or by IMEI directly
              const veh = prevVehs.find((v) => 
                (dev && v.deviceId === dev.id) || 
                (t.device_imei && v.deviceId === t.device_imei) || 
                prevVehs.length === 1
              );

              if (veh) {
                setCurrentStates((prevStates) => {
                  const newState: VehicleCurrentState = {
                    vehicleId: veh.id,
                    deviceId: dev?.id || veh.deviceId || 'dev-001',
                    customerId: veh.customerId || '',
                    organizationId: 'org-afg-01',
                    latitude: rawLat,
                    longitude: rawLng,
                    altitude: Number(t.altitude || 1790),
                    speed: rawSpeed,
                    heading: Math.round(Number(t.heading || t.course || 0)),
                    ignition: ignition,
                    door: Boolean(t.door_status),
                    batteryVoltage: Number(t.external_power_voltage || 13.8),
                    batteryPercentage: Number(t.battery_level || 95),
                    gsmSignal: Number(t.gsm_signal || 90),
                    satellites: Number(t.satellites || 12),
                    gpsValid: true,
                    onlineStatus: rawSpeed > 2 ? VehicleStatus.MOVING : (ignition ? VehicleStatus.IDLE : VehicleStatus.STOPPED),
                    lastSeenAt: timestamp,
                    lastPositionAt: timestamp,
                    odometer: 0,
                    address: `کابل (${rawLat.toFixed(4)}, ${rawLng.toFixed(4)}) • هم‌اکنون (زنده)`,
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

  const handleUpdateVehicle = async (id: string, vehData: Partial<Vehicle>) => {
    try {
      const { vehicle, error } = await globalSupabaseDataService.updateVehicle(id, {
        plateNumber: vehData.plateNumber,
        vehicleName: vehData.vehicleName,
        deviceId: vehData.deviceId,
        customerId: vehData.customerId,
      });

      if (vehicle) {
        setVehicles((prev) => prev.map((v) => (v.id === id ? vehicle : v)));
        fetchAllData();
        return { success: true };
      } else {
        return { success: false, error: error || 'خطا در ویرایش سوژه' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در ویرایش سوژه' };
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    try {
      const res = await globalSupabaseDataService.deleteVehicle(id);
      if (res.success) {
        setVehicles((prev) => prev.filter((v) => v.id !== id));
        fetchAllData();
        return { success: true };
      } else {
        return { success: false, error: res.error || 'خطا در حذف سوژه' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در حذف سوژه' };
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

  const handleUpdateDevice = async (id: string, updates: any) => {
    try {
      const { device, error } = await globalSupabaseDataService.updateDevice(id, updates);
      if (device) {
        setDevices((prev) => prev.map((d) => (d.id === id ? device : d)));
        fetchAllData();
        return { success: true };
      }
      return { success: false, error: error || 'خطا در ویرایش دستگاه' };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در ویرایش دستگاه' };
    }
  };

  const handleDeleteDevice = async (id: string) => {
    try {
      const res = await globalSupabaseDataService.deleteDevice(id);
      if (res.success) {
        setDevices((prev) => prev.filter((d) => d.id !== id));
        fetchAllData();
        return { success: true };
      }
      return { success: false, error: res.error || 'خطا در حذف دستگاه' };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در حذف دستگاه' };
    }
  };

  const handleUpdateClientProfile = async (
    id: string,
    updates: { fullName?: string; phone?: string; notes?: string }
  ) => {
    try {
      const res = await globalAuthService.updateClientProfile(id, updates);
      if (res.success) {
        fetchAllData();
        return { success: true };
      }
      return { success: false, error: res.error || 'خطا در ویرایش اطلاعات مشتری' };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در ویرایش اطلاعات مشتری' };
    }
  };

  const handleDeleteClientProfile = async (id: string) => {
    try {
      const res = await globalAuthService.deleteClientProfile(id);
      if (res.success) {
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        fetchAllData();
        return { success: true };
      }
      return { success: false, error: res.error || 'خطا در حذف مشتری' };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در حذف مشتری' };
    }
  };

  const handleSaveGeofence = async (
    gfData: Partial<Geofence>,
    isEdit = false,
    existingId?: string
  ): Promise<boolean> => {
    try {
      if (isEdit && existingId) {
        const updated = await globalSupabaseDataService.updateGeofence(existingId, gfData);
        if (updated) {
          setGeofences((prev) => prev.map((g) => (g.id === existingId ? updated : g)));
          return true;
        }
        return false;
      } else {
        const newGf = await globalSupabaseDataService.createGeofence(gfData, currentProfile?.id);
        if (newGf) {
          setGeofences((prev) => [newGf, ...prev]);
          return true;
        }
        return false;
      }
    } catch (err) {
      console.warn('[App] Save geofence error:', err);
      return false;
    }
  };

  const handleAddGeofence = async (gfData: Partial<Geofence>) => {
    await handleSaveGeofence(gfData, false);
  };

  const handleDeleteGeofence = async (id: string): Promise<boolean> => {
    try {
      const ok = await globalSupabaseDataService.deleteGeofence(id);
      if (ok) {
        setGeofences((prev) => prev.filter((g) => g.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const handleCreateAlert = async (alertData: any): Promise<FleetEvent | null> => {
    try {
      const created = await globalSupabaseDataService.createAlert(alertData);
      if (created) {
        setEvents((prev) => [created, ...prev]);
        return created;
      }
      return null;
    } catch (err) {
      console.warn('[App] Create alert error:', err);
      return null;
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

  // Filtered vehicles and states for Admin Live Map based on selected customer & status
  const adminFilteredVehicles = selectedCustomerId
    ? vehicles.filter(
        (v) =>
          v.customerId === selectedCustomerId ||
          (v as any).owner_id === selectedCustomerId ||
          (v as any).user_id === selectedCustomerId
      )
    : vehicles;

  const adminFilteredVehicleIds = new Set(adminFilteredVehicles.map((v) => v.id));

  const adminFilteredStates = selectedCustomerId
    ? currentStates.filter((s) => adminFilteredVehicleIds.has(s.vehicleId))
    : currentStates;

  const displayedStates = statusFilter
    ? adminFilteredStates.filter((s) => s.onlineStatus === statusFilter)
    : adminFilteredStates;

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

  // 4. Vehicle scoping for clients (Only show vehicles whose GPS device is active/not turned off)
  const inactiveDeviceIds = new Set(devices.filter((d) => d.status === 'INACTIVE').map((d) => d.id));

  const clientVehicles = (
    currentProfile.role === 'client'
      ? vehicles.filter(
          (v) =>
            v.customerId === currentProfile.id ||
            (v as any).owner_id === currentProfile.id ||
            (v as any).user_id === currentProfile.id
        )
      : vehicles
  ).filter((v) => !v.deviceId || !inactiveDeviceIds.has(v.deviceId));

  const clientVehicleIds = new Set(clientVehicles.map((v) => v.id));
  const clientStates = currentStates.filter((s) => clientVehicleIds.has(s.vehicleId));

  // 5. Render Customer Mobile Experience if toggled or if client role
  if (isMobileView || currentProfile.role === 'client') {
    return (
      <div className="relative font-sans" dir="rtl">
        <CustomerMobileView
          currentUser={currentUser}
          vehicles={clientVehicles.length > 0 ? clientVehicles : vehicles}
          currentStates={clientStates.length > 0 ? clientStates : currentStates}
          events={events}
          geofences={geofences}
          onSelectVehicle={(id) => {
            setSelectedVehicleId(id);
          }}
          selectedVehicleId={selectedVehicleId}
          onChangePassword={() => setIsChangePasswordOpen(true)}
          onLogout={handleLogout}
          onLoadHistory={handleLoadHistory}
          onSaveGeofence={handleSaveGeofence}
          onDeleteGeofence={handleDeleteGeofence}
          onAcknowledgeAlert={handleAcknowledgeEvent}
          onCreateAlert={handleCreateAlert}
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
          {/* TAB: LIVE MAP & MONITORING */}
          {(activeTab === 'map' || (activeTab as string) === 'dashboard') && (
            <div className="space-y-3.5">
              <CustomerMapFilter
                customers={customers}
                vehicles={vehicles}
                currentStates={currentStates}
                selectedCustomerId={selectedCustomerId}
                onSelectCustomer={(cId) => setSelectedCustomerId(cId)}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={(vId) => setSelectedVehicleId(vId)}
                statusFilter={statusFilter}
                onSelectStatusFilter={(st) => setStatusFilter(st)}
              />

              <div className="h-[calc(100vh-210px)] min-h-[500px] bg-white p-2 rounded-xl border border-slate-100 shadow-xs overflow-hidden">
                <FleetMap
                  vehicles={adminFilteredVehicles}
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
              onUpdateVehicle={handleUpdateVehicle}
              onDeleteVehicle={handleDeleteVehicle}
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
              onUpdateDevice={handleUpdateDevice}
              onDeleteDevice={handleDeleteDevice}
            />
          )}

          {/* TAB 5: HISTORY & PLAYBACK */}
          {activeTab === 'history' && (
            <TripHistoryView
              vehicles={vehicles}
              onLoadHistory={handleLoadHistory}
              onBackToLive={() => setActiveTab('map')}
            />
          )}

          {/* TAB: CUSTOMERS / CLIENT ONBOARDING */}
          {activeTab === 'customers' && (
            <CustomersManager
              customers={customers}
              vehicles={vehicles}
              currentAdmin={currentProfile || undefined}
              onUpdateCustomer={handleUpdateClientProfile}
              onDeleteCustomer={handleDeleteClientProfile}
            />
          )}

          {/* TAB: STAFF MANAGEMENT (SUPER ADMIN ONLY) */}
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
