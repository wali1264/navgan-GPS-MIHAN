/**
 * Dedicated Customer Mobile Experience
 * Mobile-first, instant full-screen live map, seamless 4-tab bottom navigation,
 * dynamic header tailored to each tab, and clean 30-day trip history replay.
 */
import React, { useState } from 'react';
import { Vehicle, VehicleCurrentState, FleetEvent, User, PositionRecord } from '../../shared/types/models';
import { MobileNav, MobileTab } from '../common/MobileNav';
import { FleetMap } from '../map/FleetMap';
import { TripHistoryView, TripHistoryFilter } from '../history/TripHistoryView';
import {
  Car,
  MapPin,
  ChevronLeft,
  KeyRound,
  LogOut,
  History,
  X,
  Layers,
  Calendar,
} from 'lucide-react';
import { VehicleStatus } from '../../shared/types/enums';

interface CustomerMobileViewProps {
  currentUser: User;
  vehicles: Vehicle[];
  currentStates: VehicleCurrentState[];
  events: FleetEvent[];
  onSelectVehicle: (vehicleId: string) => void;
  selectedVehicleId?: string;
  onChangePassword?: () => void;
  onLogout?: () => void;
  onLoadHistory?: (vehicleId: string, startTime: string, endTime: string) => Promise<PositionRecord[]>;
}

export const CustomerMobileView: React.FC<CustomerMobileViewProps> = ({
  currentUser,
  vehicles,
  currentStates,
  events,
  onSelectVehicle,
  selectedVehicleId = '',
  onChangePassword,
  onLogout,
  onLoadHistory,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('map');
  const [activeVehicleModalId, setActiveVehicleModalId] = useState<string | null>(null);

  // Dedicated state for Trip History tab
  const [historyVehicleId, setHistoryVehicleId] = useState<string>('');
  const [historyFilter, setHistoryFilter] = useState<TripHistoryFilter>('today');

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

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-800 pb-16 flex flex-col">
      {/* Dynamic Header */}
      <header className="bg-white border-b border-slate-200/90 px-3 py-2 sticky top-0 z-40 flex items-center justify-between gap-2 shadow-xs">
        {/* Case 1: Trip History Tab Header */}
        {activeTab === 'history' ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Vehicle Selector for History */}
            <div className="relative flex-1 max-w-[200px] sm:max-w-xs">
              <select
                value={historyVehicleId}
                onChange={(e) => setHistoryVehicleId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-mono transition cursor-pointer appearance-none text-ellipsis overflow-hidden pr-6"
              >
                <option value="">-- انتخاب موتر جهت مشاهده تاریخچه --</option>
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
          /* Case 2: Live Map & Other Tabs Header */
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 max-w-[240px] sm:max-w-xs">
              <select
                value={selectedVehicleId || ''}
                onChange={(e) => onSelectVehicle(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-mono transition cursor-pointer appearance-none text-ellipsis overflow-hidden pr-6"
              >
                <option value="">همه موترها ({activeVehicles.length})</option>
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

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer active:scale-95 shrink-0"
            title="خروج از حساب کاربری"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        )}
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 flex flex-col p-2.5 sm:p-4 pb-20 md:pb-6">
        {/* 1. LIVE MAP VIEW (Default landing view) */}
        {(activeTab === 'map' || activeTab === 'home') && (
          <div className="relative w-full h-[calc(100vh-125px)] min-h-[460px] rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-white">
            {/* Live Map Component */}
            <FleetMap
              vehicles={activeVehicles}
              currentStates={currentStates}
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
                <span>نمایش همه موترها</span>
              </button>
            )}
          </div>
        )}

        {/* 2. HISTORY TAB (30 Days Route Replay & Analysis) */}
        {activeTab === 'history' && (
          <div className="space-y-2">
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
          <div className="space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xs font-bold text-slate-900">لیست موترهای ثبت‌شده ({activeVehicles.length})</h2>
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
                  className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2.5 shadow-xs"
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
        )}

        {/* 4. ACCOUNT TAB */}
        {activeTab === 'account' && (
          <div className="space-y-3.5">
            <div className="bg-white border border-slate-200 p-4 rounded-xl text-center space-y-1.5 shadow-xs">
              <div className="w-14 h-14 rounded-full bg-blue-600 text-white font-bold text-lg flex items-center justify-center mx-auto shadow-xs">
                {currentUser.fullName ? currentUser.fullName.slice(0, 1) : 'U'}
              </div>
              <h2 className="text-sm font-bold text-slate-900">{currentUser.fullName}</h2>
              <p className="text-xs text-blue-600 font-medium font-mono">{currentUser.email}</p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              {onChangePassword && (
                <button
                  onClick={onChangePassword}
                  className="w-full bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <KeyRound className="w-3.5 h-3.5" />
                    </div>
                    <span>تغییر رمز عبور</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
              )}

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full bg-white border border-rose-100 p-3 rounded-xl flex items-center justify-between text-xs font-semibold text-rose-600 hover:bg-rose-50 transition shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <LogOut className="w-3.5 h-3.5" />
                    </div>
                    <span>خروج از حساب کاربری</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-rose-400" />
                </button>
              )}
            </div>

            <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2 text-xs text-slate-600 shadow-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>وضعیت حساب:</span>
                <span className="text-emerald-600 font-bold">● فعال و متصل به ماهواره</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>پایگاه‌داده ردیابی:</span>
                <span className="text-blue-600 font-mono font-bold">Supabase Realtime GPS</span>
              </div>
            </div>
          </div>
        )}
      </main>

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
