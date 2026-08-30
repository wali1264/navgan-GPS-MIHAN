/**
 * Main Application Component
 * Integrates real-time WebSocket state updates, REST APIs, responsive Desktop & Mobile layouts,
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
import { CustomerMobileView } from './components/mobile/CustomerMobileView';
import { UserRole, VehicleStatus, CommandType } from './shared/types/enums';
import { Vehicle, Device, Customer, Driver, VehicleCurrentState, Geofence, FleetEvent, DeviceCommand, User, PositionRecord } from './shared/types/models';

export function App() {
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'usr-admin-01',
    organizationId: 'org-afg-01',
    role: UserRole.SUPER_ADMIN,
    fullName: 'مدیر ارشد سامانه (Admin)',
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

  // Fetch initial datasets
  const fetchAllData = useCallback(async () => {
    try {
      const [vRes, dRes, cRes, drRes, sRes, gRes, eRes, cmdRes] = await Promise.all([
        fetch('/api/vehicles'),
        fetch('/api/devices'),
        fetch('/api/customers'),
        fetch('/api/drivers'),
        fetch('/api/positions/current'),
        fetch('/api/geofences'),
        fetch('/api/events'),
        fetch('/api/commands'),
      ]);

      if (vRes.ok) setVehicles(await vRes.json());
      if (dRes.ok) setDevices(await dRes.json());
      if (cRes.ok) setCustomers(await cRes.json());
      if (drRes.ok) setDrivers(await drRes.json());
      if (sRes.ok) setCurrentStates(await sRes.json());
      if (gRes.ok) setGeofences(await gRes.json());
      if (eRes.ok) setEvents(await eRes.json());
      if (cmdRes.ok) setCommands(await cmdRes.json());
    } catch (err) {
      console.warn('[App] Fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    // Fallback periodic poll in case WebSocket is reconnecting
    const interval = setInterval(fetchAllData, 6000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // WebSocket Live Telemetry Stream
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function connectWs() {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[App WS] Connected to live GPS stream');
        };

        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.type === 'STATE_UPDATE' && data.state) {
              const updatedState: VehicleCurrentState = data.state;
              setCurrentStates((prev) => {
                const idx = prev.findIndex((s) => s.vehicleId === updatedState.vehicleId);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = updatedState;
                  return updated;
                }
                return [...prev, updatedState];
              });

              if (data.events && Array.isArray(data.events) && data.events.length > 0) {
                setEvents((prev) => [...data.events, ...prev]);
              }
            }
          } catch (e) {
            console.warn('[App WS] JSON parse error:', e);
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 3000);
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connectWs, 3000);
      }
    }

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Handlers
  const handleSwitchRole = async (role: UserRole) => {
    try {
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        fetchAllData();
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleAddVehicle = async (vehData: Partial<Vehicle>) => {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehData),
      });
      if (res.ok) {
        const newV = await res.json();
        setVehicles((prev) => [...prev, newV]);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleAddDevice = async (deviceData: Partial<Device>) => {
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceData),
      });
      if (res.ok) {
        const newD = await res.json();
        setDevices((prev) => [...prev, newD]);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleAddGeofence = async (gfData: Partial<Geofence>) => {
    try {
      const res = await fetch('/api/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gfData),
      });
      if (res.ok) {
        const newG = await res.json();
        setGeofences((prev) => [...prev, newG]);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleDeleteGeofence = async (id: string) => {
    try {
      await fetch(`/api/geofences/${id}`, { method: 'DELETE' });
      setGeofences((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.warn(err);
    }
  };

  const handleAcknowledgeEvent = async (eventId: string) => {
    try {
      await fetch(`/api/events/${eventId}/ack`, { method: 'POST' });
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
    const res = await fetch('/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, vehicleId, commandType, parameters }),
    });
    if (res.ok) {
      const newCmd = await res.json();
      setCommands((prev) => [newCmd, ...prev]);
    }
  };

  const handleLoadHistory = async (
    vehicleId: string,
    startTime: string,
    endTime: string
  ): Promise<PositionRecord[]> => {
    const res = await fetch(
      `/api/history/${vehicleId}?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
    );
    if (res.ok) {
      return await res.json();
    }
    return [];
  };

  const activeAlertsCount = events.filter((e) => !e.isAcknowledged).length;

  // Filtered vehicles & states for current view
  const displayedStates = statusFilter
    ? currentStates.filter((s) => s.onlineStatus === statusFilter)
    : currentStates;

  // Render Customer Mobile Experience if toggled
  if (isMobileView) {
    return (
      <CustomerMobileView
        currentUser={currentUser}
        vehicles={vehicles}
        currentStates={currentStates}
        events={events}
        onSelectVehicle={(id) => {
          setSelectedVehicleId(id);
        }}
        selectedVehicleId={selectedVehicleId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white" dir="rtl">
      {/* Header */}
      <Header
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        activeAlertsCount={activeAlertsCount}
        onRefresh={fetchAllData}
        isMobileView={isMobileView}
        onToggleMobileView={() => setIsMobileView(!isMobileView)}
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
                  <p className="text-slate-500 text-xs mt-1">آخرین تلمتری دریافتی از گیت‌وی کابل - {new Date().toLocaleTimeString('fa-AF')}</p>
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
                <div className="lg:col-span-3 h-[540px] bg-white p-2 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
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
                <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col h-[540px]">
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
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">فیلتر وضعیت ناوگان:</span>
                  <button
                    onClick={() => setStatusFilter(undefined)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      !statusFilter ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    همه ({vehicles.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter(VehicleStatus.MOVING)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      statusFilter === VehicleStatus.MOVING
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    حرکت
                  </button>
                  <button
                    onClick={() => setStatusFilter(VehicleStatus.STOPPED)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      statusFilter === VehicleStatus.STOPPED
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    توقف
                  </button>
                </div>
              </div>

              <div className="h-[calc(100vh-180px)] bg-white p-2 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
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

          {/* TAB 10: CUSTOMERS */}
          {activeTab === 'customers' && (
            <CustomersManager
              customers={customers}
              vehicles={vehicles}
            />
          )}

          {/* TAB 11: COMMANDS */}
          {activeTab === 'commands' && (
            <CommandsView
              vehicles={vehicles}
              devices={devices}
              commands={commands}
              onSendCommand={handleSendCommand}
            />
          )}

          {/* TAB 12: DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <DiagnosticsView />
          )}

          {/* TAB 13: MAINTENANCE */}
          {activeTab === 'maintenance' && (
            <MaintenanceView vehicles={vehicles} />
          )}
        </main>
      </div>
    </div>
  );
}
export default App;
