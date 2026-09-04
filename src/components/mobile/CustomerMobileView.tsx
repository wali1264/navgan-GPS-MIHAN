/**
 * Dedicated Customer Mobile Experience
 * Mobile-first, instant full-screen live map, seamless 4-tab bottom navigation,
 * dynamic header tailored to each tab, and clean 30-day trip history replay.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Vehicle, VehicleCurrentState, FleetEvent, User, PositionRecord, Geofence } from '../../shared/types/models';
import { MobileNav, MobileTab } from '../common/MobileNav';
import { FleetMap } from '../map/FleetMap';
import { TripHistoryView, TripHistoryFilter } from '../history/TripHistoryView';
import { CustomerGeofenceEditor } from '../geofences/CustomerGeofenceEditor';
import { GeofenceEngine } from '../../services/geofence-engine';
import {
  Car,
  MapPin,
  ChevronLeft,
  ChevronDown,
  KeyRound,
  LogOut,
  History,
  X,
  Layers,
  Calendar,
  User as UserIcon,
  Bell,
  ShieldAlert,
  Check,
  Clock,
  Gauge,
  AlertTriangle,
} from 'lucide-react';
import { VehicleStatus, EventType, EventSeverity } from '../../shared/types/enums';

interface CustomerMobileViewProps {
  currentUser: User;
  vehicles: Vehicle[];
  currentStates: VehicleCurrentState[];
  events: FleetEvent[];
  geofences?: Geofence[];
  onSelectVehicle: (vehicleId: string) => void;
  selectedVehicleId?: string;
  onChangePassword?: () => void;
  onLogout?: () => void;
  onLoadHistory?: (vehicleId: string, startTime: string, endTime: string) => Promise<PositionRecord[]>;
  onSaveGeofence?: (geofence: Partial<Geofence>, isEdit: boolean, existingId?: string) => Promise<boolean>;
  onDeleteGeofence?: (id: string) => Promise<boolean>;
  onAcknowledgeAlert?: (id: string) => void;
  onCreateAlert?: (alert: any) => Promise<FleetEvent | null>;
}

export const CustomerMobileView: React.FC<CustomerMobileViewProps> = ({
  currentUser,
  vehicles,
  currentStates,
  events,
  geofences = [],
  onSelectVehicle,
  selectedVehicleId = '',
  onChangePassword,
  onLogout,
  onLoadHistory,
  onSaveGeofence,
  onDeleteGeofence,
  onAcknowledgeAlert,
  onCreateAlert,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('map');
  const [activeVehicleModalId, setActiveVehicleModalId] = useState<string | null>(null);

  // Dedicated state for Trip History tab
  const [historyVehicleId, setHistoryVehicleId] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<TripHistoryFilter>('today');

  // Geofence & Alert states
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isGeofenceAccordionOpen, setIsGeofenceAccordionOpen] = useState(false);
  const [toastAlert, setToastAlert] = useState<{ id: string; title: string; vehiclePlate: string; text: string } | null>(null);
  const [localAlerts, setLocalAlerts] = useState<FleetEvent[]>(events);

  // Keep localAlerts synced with incoming events
  useEffect(() => {
    setLocalAlerts(events);
  }, [events]);

  // Track previous inside/outside state of each vehicle relative to each geofence
  const lastGeofenceStates = useRef<Map<string, boolean>>(new Map());

  // Real-time Geofence Checking
  useEffect(() => {
    if (!geofences || geofences.length === 0 || !currentStates || currentStates.length === 0) return;

    currentStates.forEach((state) => {
      const vehicle = vehicles.find((v) => v.id === state.vehicleId);
      if (!vehicle) return;

      const matchingGeofences = geofences.filter(
        (gf) => gf.assignedVehicleIds.length === 0 || gf.assignedVehicleIds.includes(vehicle.id)
      );

      matchingGeofences.forEach((gf) => {
        const key = `${vehicle.id}_${gf.id}`;
        const isInside = GeofenceEngine.isPointInside(state.latitude, state.longitude, gf);
        const previous = lastGeofenceStates.current.get(key);

        if (previous !== undefined) {
          // Check Exit Event
          if (previous === true && !isInside && gf.notifyOnExit) {
            const title = 'خروج از محدوده جغرافیایی';
            const text = `موتر ${vehicle.plateNumber} (${vehicle.vehicleName}) از محدوده «${gf.name}» خارج شد!`;
            const newAlert: FleetEvent = {
              id: 'alert-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              organizationId: 'org-afg-01',
              customerId: currentUser.id,
              vehicleId: vehicle.id,
              deviceId: vehicle.deviceId || '',
              type: EventType.GEOFENCE_EXIT,
              severity: EventSeverity.WARNING,
              description: text,
              timestamp: new Date().toISOString(),
              latitude: state.latitude,
              longitude: state.longitude,
              speed: state.speed,
              isAcknowledged: false,
            };

            setLocalAlerts((prev) => [newAlert, ...prev]);

            // Show Toast Banner
            setToastAlert({
              id: newAlert.id,
              title,
              vehiclePlate: vehicle.plateNumber,
              text,
            });

            // Auto-dismiss after 3 seconds
            setTimeout(() => {
              setToastAlert((curr) => (curr?.id === newAlert.id ? null : curr));
            }, 3000);

            if (onCreateAlert) {
              onCreateAlert({
                owner_id: currentUser.id,
                vehicle_id: vehicle.id,
                device_imei: vehicle.deviceId,
                title,
                description: text,
                lat: state.latitude,
                lng: state.longitude,
                speed: state.speed,
                type: EventType.GEOFENCE_EXIT,
                severity: EventSeverity.WARNING,
              });
            }
          }

          // Check Enter Event
          if (previous === false && isInside && gf.notifyOnEnter) {
            const title = 'ورود به محدوده جغرافیایی';
            const text = `موتر ${vehicle.plateNumber} (${vehicle.vehicleName}) به محدوده «${gf.name}» وارد شد.`;
            const newAlert: FleetEvent = {
              id: 'alert-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
              organizationId: 'org-afg-01',
              customerId: currentUser.id,
              vehicleId: vehicle.id,
              deviceId: vehicle.deviceId || '',
              type: EventType.GEOFENCE_ENTER,
              severity: EventSeverity.INFO,
              description: text,
              timestamp: new Date().toISOString(),
              latitude: state.latitude,
              longitude: state.longitude,
              speed: state.speed,
              isAcknowledged: false,
            };

            setLocalAlerts((prev) => [newAlert, ...prev]);

            setToastAlert({
              id: newAlert.id,
              title,
              vehiclePlate: vehicle.plateNumber,
              text,
            });

            setTimeout(() => {
              setToastAlert((curr) => (curr?.id === newAlert.id ? null : curr));
            }, 3000);

            if (onCreateAlert) {
              onCreateAlert({
                owner_id: currentUser.id,
                vehicle_id: vehicle.id,
                device_imei: vehicle.deviceId,
                title,
                description: text,
                lat: state.latitude,
                lng: state.longitude,
                speed: state.speed,
                type: EventType.GEOFENCE_ENTER,
                severity: EventSeverity.INFO,
              });
            }
          }
        }

        lastGeofenceStates.current.set(key, isInside);
      });
    });
  }, [currentStates, geofences, vehicles, currentUser.id, onCreateAlert]);

  // Filter alerts for client's vehicles
  const vehicleIdsSet = new Set(vehicles.map((v) => v.id));
  const relevantAlerts = localAlerts.filter(
    (a) => vehicleIdsSet.has(a.vehicleId) || a.customerId === currentUser.id
  );
  const unreadAlertsCount = relevantAlerts.filter((a) => !a.isAcknowledged).length;

  const handleAcknowledge = (alertId: string) => {
    setLocalAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isAcknowledged: true } : a))
    );
    if (onAcknowledgeAlert) {
      onAcknowledgeAlert(alertId);
    }
  };

  const handleMarkAllRead = () => {
    relevantAlerts.forEach((a) => {
      if (!a.isAcknowledged) handleAcknowledge(a.id);
    });
  };

  const activeVehicles = vehicles;
  const activeModalVehicle = vehicles.find((v) => v.id === activeVehicleModalId);
  const activeModalState = currentStates.find((s) => s.vehicleId === activeVehicleModalId);

  // Status helper for Persian badges
  const getStatusInfo = (state?: VehicleCurrentState) => {
    if (!state) {
      return {
        label: 'بدون ارتباط',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        dotClass: 'bg-slate-400',
      };
    }

    if (state.onlineStatus === VehicleStatus.MOVING) {
      return {
        label: `در حال حرکت (${state.speed} km/h)`,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500 animate-pulse',
      };
    }
    if (state.onlineStatus === VehicleStatus.IDLE) {
      return {
        label: 'روشن و متوقف',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotClass: 'bg-amber-500',
      };
    }
    if (state.onlineStatus === VehicleStatus.STOPPED) {
      return {
        label: 'خاموش / متوقف',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        dotClass: 'bg-slate-500',
      };
    }

    return {
      label: 'قطع ارتباط (آفلاین)',
      badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
      dotClass: 'bg-slate-400',
    };
  };

  const movingCount = currentStates.filter((s) => s.onlineStatus === VehicleStatus.MOVING).length;
  const username = currentUser.email ? currentUser.email.split('@')[0] : '';

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-800 pb-16 flex flex-col">
      {/* Dynamic Header */}
      <header className="bg-white border-b border-slate-200/90 px-3 md:px-5 py-2 sticky top-0 z-40 flex items-center justify-between gap-3 shadow-xs">
        {/* Right side: Vehicle / Date Selector & Logo/Title */}
        {activeTab === 'history' ? (
          <div className="flex items-center gap-2 flex-1 md:flex-initial min-w-0">
            {/* Vehicle Selector for History */}
            <div className="relative flex-1 md:w-64">
              <select
                value={historyVehicleId}
                onChange={(e) => setHistoryVehicleId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-mono transition cursor-pointer appearance-none text-ellipsis overflow-hidden pr-6"
              >
                <option value="">-- انتخاب دستگاه جهت تاریخچه --</option>
                {activeVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} ({v.vehicleName})
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Car className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Compact Date Filter Dropdown */}
            <div className="relative flex items-center bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 gap-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value as TripHistoryFilter)}
                className="bg-transparent text-xs font-bold text-blue-900 focus:outline-none cursor-pointer appearance-none pr-4"
              >
                <option value="today">امروز</option>
                <option value="yesterday">دیروز</option>
                <option value="week">۷ روز اخیر</option>
                <option value="month">کل ۳۰ روز</option>
              </select>
              <span className="text-[9px] text-blue-500 pointer-events-none absolute right-1">▼</span>
            </div>
          </div>
        ) : (
          /* Case 2: Live Map & Other Tabs Header (Vehicle Selector) */
          <div className="flex items-center gap-2 flex-1 md:flex-initial min-w-0">
            <div className="relative flex-1 md:w-64">
              <select
                value={selectedVehicleId || ''}
                onChange={(e) => onSelectVehicle(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-mono transition cursor-pointer appearance-none text-ellipsis overflow-hidden pr-6"
              >
                <option value="">همه دستگاه‌ها ({activeVehicles.length})</option>
                {activeVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} ({v.vehicleName})
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Car className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        )}

        {/* Center: Desktop Navigation Bar (Only visible on md screens and up) */}
        <nav className="hidden md:flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 gap-1 select-none">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'map' || activeTab === 'home'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>نقشه زنده</span>
            {activeVehicles.length > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'map' || activeTab === 'home'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {activeVehicles.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>تاریخچه ۳۰ روز</span>
          </button>

          <button
            onClick={() => setActiveTab('vehicles')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'vehicles'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>لیست دستگاه‌ها</span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'account'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>حساب من</span>
          </button>
        </nav>

        {/* Left side: User Info, Bell Button & Logout Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-2 text-left pl-2 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
              {currentUser.fullName ? currentUser.fullName.slice(0, 1) : 'U'}
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-slate-800 leading-tight">{currentUser.fullName}</div>
              <div className="text-[10px] text-slate-500 font-mono">نام کاربری: {username}</div>
            </div>
          </div>

          {/* Compact Notification Bell Icon */}
          <button
            onClick={() => setIsAlertModalOpen(!isAlertModalOpen)}
            className={`relative p-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center transition shadow-xs cursor-pointer active:scale-95 ${
              unreadAlertsCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title="هشدارهای امنیتی و محدوده جغرافیایی"
          >
            <Bell className={`w-3.5 h-3.5 ${unreadAlertsCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-600'}`} />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-mono font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
              </span>
            )}
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 px-2.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer active:scale-95"
              title="خروج از حساب کاربری"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 flex flex-col p-2.5 sm:p-4 md:p-6 pb-20 md:pb-6">
        {/* 1. LIVE MAP VIEW (Default landing view) */}
        {(activeTab === 'map' || activeTab === 'home') && (
          <div className="relative w-full h-[calc(100vh-125px)] min-h-[460px] md:h-[calc(100vh-110px)] rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-white">
            {/* Live Map Component */}
            <FleetMap
              vehicles={activeVehicles}
              currentStates={currentStates}
              geofences={geofences}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={(id) => {
                onSelectVehicle(id);
                setActiveVehicleModalId(id);
              }}
              className="w-full h-full"
            />

            {/* Quick Floating Status Chip on Map (Top Left to avoid layer controls) */}
            <div className="absolute top-2.5 left-2.5 z-[400] bg-white/95 backdrop-blur border border-slate-200 px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-2 text-[11px]">
              <div className="flex items-center gap-1 text-emerald-700 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{movingCount} در حرکت</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="text-slate-600 font-medium">
                کل: <strong className="font-mono text-slate-900">{activeVehicles.length}</strong>
              </div>
            </div>

            {/* Reset to All Vehicles Pill if filtered */}
            {selectedVehicleId && (
              <button
                onClick={() => onSelectVehicle('')}
                className="absolute top-11 left-2.5 z-[400] bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition active:scale-95"
              >
                <Layers className="w-3 h-3" />
                <span>نمایش همه دستگاه‌ها</span>
              </button>
            )}
          </div>
        )}

        {/* 2. HISTORY TAB (30 Days Route Replay & Analysis) */}
        {activeTab === 'history' && (
          <div className="w-full max-w-5xl mx-auto space-y-3">
            <TripHistoryView
              vehicles={activeVehicles}
              selectedVehicleId={historyVehicleId}
              activeFilter={historyFilter}
              onLoadHistory={onLoadHistory || (async () => [])}
            />
          </div>
        )}

        {/* 3. VEHICLES LIST TAB */}
        {activeTab === 'vehicles' && (
          <div className="w-full max-w-5xl mx-auto space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xs md:text-sm font-bold text-slate-900">لیست دستگاه‌های تحت پوشش ({activeVehicles.length})</h2>
              <button
                onClick={() => {
                  onSelectVehicle('');
                  setActiveTab('map');
                }}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>مشاهده همه روی نقشه</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeVehicles.map((v) => {
                const state = currentStates.find((s) => s.vehicleId === v.id);
                const statusInfo = getStatusInfo(state);
                const isOffline = !state || state.onlineStatus === VehicleStatus.OFFLINE;
                const batteryDisplay =
                  isOffline
                    ? 'قطع ارتباط'
                    : state?.batteryVoltage !== undefined
                    ? `${state.batteryVoltage}V`
                    : 'بدون سنسور';
                const signalDisplay = isOffline ? 'قطع' : `${state?.gsmSignal || 0}%`;

                return (
                  <div
                    key={v.id}
                    className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2.5 shadow-xs hover:border-blue-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 font-mono">{v.plateNumber}</h3>
                        <p className="text-xs text-slate-500">{v.vehicleName}</p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold border flex items-center gap-1.5 ${statusInfo.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`}></span>
                        <span>{statusInfo.label}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs text-slate-700">
                      <div>
                        ⚡ سرعت: <strong className="text-slate-900 font-mono">{state?.speed || 0}</strong> km/h
                      </div>
                      <div>
                        📡 سیگنال: <strong className="text-slate-900 font-mono">{signalDisplay}</strong>
                      </div>
                      <div className="col-span-2">
                        🔋 ولتاژ بطری: <strong className="text-slate-900 font-mono">{batteryDisplay}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <button
                        onClick={() => {
                          onSelectVehicle(v.id);
                          setActiveTab('map');
                        }}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>ردیابی زنده</span>
                      </button>

                      <button
                        onClick={() => {
                          setHistoryVehicleId(v.id);
                          setActiveTab('history');
                        }}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>تاریخچه ۳۰ روز</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. ACCOUNT TAB */}
        {activeTab === 'account' && (
          <div className="w-full max-w-md mx-auto space-y-3.5">
            <div className="bg-white border border-slate-200 p-5 rounded-xl text-center space-y-2 shadow-xs">
              <h2 className="text-lg md:text-xl font-black text-slate-900">{currentUser.fullName}</h2>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-lg text-xs text-slate-700 font-medium">
                <span>نام کاربری:</span>
                <span className="font-mono font-bold text-blue-700">{username}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              {/* Geofence Management Accordion (Clean & collapsed by default) */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => setIsGeofenceAccordionOpen(!isGeofenceAccordionOpen)}
                  className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">تنظیم محدوده جغرافیایی (Geofence)</div>
                      <div className="text-[10px] text-slate-500 font-normal">تعیین ساحه مجاز و هشدار خروج/ورود برای هر دستگاه</div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isGeofenceAccordionOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isGeofenceAccordionOpen && (
                  <div className="p-3.5 pt-1 border-t border-slate-100">
                    <CustomerGeofenceEditor
                      vehicles={vehicles}
                      geofences={geofences}
                      selectedVehicleId={selectedVehicleId}
                      currentStates={currentStates}
                      onSaveGeofence={onSaveGeofence || (async () => false)}
                      onDeleteGeofence={onDeleteGeofence || (async () => false)}
                    />
                  </div>
                )}
              </div>

              {onChangePassword && (
                <button
                  onClick={onChangePassword}
                  className="w-full bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <span>تغییر رمز عبور</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
              )}

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full bg-white border border-rose-100 p-3.5 rounded-xl flex items-center justify-between text-xs font-semibold text-rose-600 hover:bg-rose-50 transition shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span>خروج از حساب کاربری</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-rose-400" />
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Instant Floating Toast Alert (Auto fades after 3 seconds or manual close) */}
      {toastAlert && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[99999] w-[92%] max-w-sm animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-2xl border border-rose-500/40 backdrop-blur-md flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 shrink-0 mt-0.5 animate-bounce">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 text-right">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-rose-300">{toastAlert.title}</span>
                  <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.2 rounded font-bold">
                    {toastAlert.vehiclePlate}
                  </span>
                </div>
                <p className="text-[11px] text-slate-200 leading-snug">{toastAlert.text}</p>
              </div>
            </div>
            <button
              onClick={() => setToastAlert(null)}
              className="p-1 text-slate-400 hover:text-white rounded-md transition cursor-pointer"
              title="بستن اعلان"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bell Alert Modal: Detailed Alert History */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] text-right" dir="rtl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">هشدارهای امنیتی و رخدادها</h3>
                  <p className="text-[11px] text-slate-500">
                    {unreadAlertsCount > 0 ? `${unreadAlertsCount} هشدار خوانده‌نشده` : 'تمام هشدارها بررسی شده‌اند'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {unreadAlertsCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                  >
                    خواندن همه
                  </button>
                )}
                <button
                  onClick={() => setIsAlertModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Alerts List */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100">
              {relevantAlerts.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">هیچ هشداری ثبت نشده است</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    تمام وسایط نقلیه شما در وضعیت عادی و درون محدوده‌های تعیین‌شده قرار دارند.
                  </p>
                </div>
              ) : (
                relevantAlerts.map((alert) => {
                  const vehicle = vehicles.find((v) => v.id === alert.vehicleId);
                  const isExit = alert.type === EventType.GEOFENCE_EXIT;
                  const isSpeed = alert.type === EventType.OVERSPEED;

                  return (
                    <div
                      key={alert.id}
                      className={`pt-2.5 first:pt-0 p-2 rounded-xl transition ${
                        !alert.isAcknowledged ? 'bg-amber-50/60 border border-amber-200' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <div
                            className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                              isExit
                                ? 'bg-rose-100 text-rose-600'
                                : isSpeed
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-blue-100 text-blue-600'
                            }`}
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900">
                                {isExit
                                  ? 'خروج از محدوده مجاز'
                                  : alert.type === EventType.GEOFENCE_ENTER
                                  ? 'ورود به محدوده'
                                  : isSpeed
                                  ? 'سرعت غیرمجاز'
                                  : 'هشدار امنیتی'}
                              </span>
                              {vehicle && (
                                <span className="font-mono text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                  {vehicle.plateNumber}
                                </span>
                              )}
                              {!alert.isAcknowledged && (
                                <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(alert.timestamp).toLocaleTimeString('fa-AF')}</span>
                              </span>
                              {alert.speed !== undefined && (
                                <span className="flex items-center gap-1">
                                  <Gauge className="w-3 h-3" />
                                  <span>{alert.speed} km/h</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {!alert.isAcknowledged && (
                          <button
                            type="button"
                            onClick={() => handleAcknowledge(alert.id)}
                            className="px-2 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold shrink-0 transition cursor-pointer"
                          >
                            تایید
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">تاریخچه هشدارها برای دستگاه‌های فعال شما</span>
              <button
                type="button"
                onClick={() => setIsAlertModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Quick Bottom Sheet Modal */}
      {activeVehicleModalId && activeModalVehicle && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white w-full max-w-sm rounded-2xl p-4 space-y-3 shadow-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-mono">
                  {activeModalVehicle.plateNumber}
                </h3>
                <p className="text-xs text-slate-500">{activeModalVehicle.vehicleName}</p>
              </div>
              <button
                onClick={() => setActiveVehicleModalId(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const isOffline = !activeModalState || activeModalState.onlineStatus === VehicleStatus.OFFLINE;
              const batteryDisplay =
                isOffline
                  ? 'قطع ارتباط'
                  : activeModalState?.batteryVoltage !== undefined
                  ? `${activeModalState.batteryVoltage}V`
                  : 'بدون سنسور';
              const signalDisplay = isOffline ? 'قطع' : `${activeModalState?.gsmSignal || 0}%`;

              return (
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    سرعت فعلی:{' '}
                    <strong className="text-slate-900 font-mono">{activeModalState?.speed || 0} km/h</strong>
                  </div>
                  <div>
                    سیگنال آنتن:{' '}
                    <strong className="text-slate-900 font-mono">{signalDisplay}</strong>
                  </div>
                  <div className="col-span-2">
                    ولتاژ بطری:{' '}
                    <strong className="text-slate-900 font-mono">{batteryDisplay}</strong>
                  </div>
                </div>
              );
            })()}

            <div className="text-xs text-slate-500 truncate">
              📍 {activeModalState?.address || 'افغانستان'}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  onSelectVehicle(activeModalVehicle.id);
                  setActiveVehicleModalId(null);
                  setActiveTab('map');
                }}
                className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1 transition active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>فوکوس نقشه</span>
              </button>
              <button
                onClick={() => {
                  setHistoryVehicleId(activeModalVehicle.id);
                  setActiveVehicleModalId(null);
                  setActiveTab('history');
                }}
                className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center gap-1 transition active:scale-95"
              >
                <History className="w-3.5 h-3.5" />
                <span>تاریخچه ۳۰ روز</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <MobileNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeVehiclesCount={activeVehicles.length}
      />
    </div>
  );
};
