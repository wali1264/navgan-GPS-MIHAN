/**
 * Dedicated Customer Mobile Experience
 * Designed specifically for smartphone screens with touch gestures, quick vehicle status, and live map view.
 */
import React, { useState } from 'react';
import { Vehicle, VehicleCurrentState, FleetEvent, User, PositionRecord } from '../../shared/types/models';
import { MobileNav, MobileTab } from '../common/MobileNav';
import { FleetMap } from '../map/FleetMap';
import { TripHistoryView } from '../history/TripHistoryView';
import { Car, Navigation, Shield, Key, Battery, Signal, Bell, Phone, MapPin, Gauge, ChevronLeft, PowerOff, CheckCircle, KeyRound, LogOut, History, ArrowRight, RefreshCw, Radio, X } from 'lucide-react';
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
  selectedVehicleId,
  onChangePassword,
  onLogout,
  onLoadHistory,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [activeVehicleModalId, setActiveVehicleModalId] = useState<string | null>(null);

  const activeVehicles = vehicles;
  const activeAlerts = events.filter((e) => !e.isAcknowledged);

  const activeModalVehicle = vehicles.find((v) => v.id === activeVehicleModalId);
  const activeModalState = currentStates.find((s) => s.vehicleId === activeVehicleModalId);

  // Status helper for clean Persian badges
  const getStatusInfo = (state?: VehicleCurrentState) => {
    if (!state) {
      return {
        label: 'بدون ارتباط',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        dotClass: 'bg-slate-400',
        isLive: false,
      };
    }

    if (state.onlineStatus === VehicleStatus.MOVING) {
      return {
        label: `در حال حرکت (${state.speed} km/h)`,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500 animate-pulse',
        isLive: true,
      };
    }
    if (state.onlineStatus === VehicleStatus.IDLE) {
      return {
        label: 'روشن و متوقف',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotClass: 'bg-amber-500',
        isLive: true,
      };
    }
    if (state.onlineStatus === VehicleStatus.STOPPED) {
      return {
        label: 'خاموش / متوقف',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        dotClass: 'bg-blue-500',
        isLive: true,
      };
    }

    return {
      label: 'آفلاین (قطع ارتباط)',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      dotClass: 'bg-slate-400',
      isLive: false,
    };
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-800 pb-20 flex flex-col">
      {/* Mobile Top App Bar */}
      <div className="bg-white/95 backdrop-blur border-b border-slate-100 p-4 sticky top-0 z-40 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-900">اپلیکیشن ردیابی موتر</h1>
            <p className="text-[10px] text-blue-600 font-medium">{currentUser.fullName || 'سامانه ردیابی GPS افغانستان'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>GPS زنده</span>
          </span>
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 flex items-center gap-1 text-[11px] font-bold"
              title="خروج از حساب"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 p-4">
        {/* 1. HOME TAB */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Quick Action Navigation Grid for Customer */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <button
                onClick={() => setActiveTab('map')}
                className="p-3 bg-blue-600 text-white rounded-xl shadow-xs font-bold text-xs flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:bg-blue-700 cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                <span>نقشه زنده</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className="p-3 bg-indigo-600 text-white rounded-xl shadow-xs font-bold text-xs flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:bg-indigo-700 cursor-pointer"
              >
                <History className="w-4 h-4" />
                <span>تاریخچه ۳۰ روز</span>
              </button>
              <button
                onClick={() => setActiveTab('vehicles')}
                className="p-3 bg-slate-800 text-white rounded-xl shadow-xs font-bold text-xs flex flex-col items-center justify-center gap-1.5 active:scale-95 transition hover:bg-slate-900 cursor-pointer"
              >
                <Car className="w-4 h-4" />
                <span>لیست موترها</span>
              </button>
            </div>

            {/* Quick Map Preview Widget */}
            <div className="h-64 rounded-xl overflow-hidden border border-slate-100 shadow-xs relative bg-white">
              <FleetMap
                vehicles={activeVehicles}
                currentStates={currentStates}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={(id) => {
                  onSelectVehicle(id);
                  setActiveTab('map');
                }}
                className="h-full"
              />
              <button
                onClick={() => setActiveTab('map')}
                className="absolute bottom-3 left-3 z-[400] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer transition active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>نمای تمام‌صفحه نقشه</span>
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <div className="text-xs text-slate-500">تعداد موترهای شما</div>
                <div className="text-xl font-bold font-mono text-blue-600 mt-0.5">{activeVehicles.length} موتر</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <div className="text-xs text-slate-500">هشدارهای بررسی نشده</div>
                <div className="text-xl font-bold font-mono text-rose-600 mt-0.5">{activeAlerts.length} مورد</div>
              </div>
            </div>

            {/* Vehicles Cards List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-900">وضعیت زنده موترها</h2>
                <button onClick={() => setActiveTab('vehicles')} className="text-xs text-blue-600 font-medium cursor-pointer">
                  مشاهده همه
                </button>
              </div>

              {activeVehicles.map((v) => {
                const state = currentStates.find((s) => s.vehicleId === v.id);
                const statusInfo = getStatusInfo(state);

                return (
                  <div
                    key={v.id}
                    onClick={() => setActiveVehicleModalId(v.id)}
                    className="bg-white border border-slate-100 p-3.5 rounded-xl flex items-center justify-between gap-2 shadow-xs active:scale-[0.98] transition cursor-pointer hover:border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 font-mono">{v.plateNumber}</span>
                          <span className="text-[11px] text-slate-500">({v.vehicleName})</span>
                          <span className={`text-[10px] px-2 py-0.2 rounded-full border font-semibold flex items-center gap-1 ${statusInfo.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`}></span>
                            <span>{statusInfo.label}</span>
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-blue-600">⚡ {state?.speed || 0} km/h</span>
                          <span>•</span>
                          <span className={state?.ignition ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            {state?.ignition ? '🔑 سویچ روشن' : 'سویچ خاموش'}
                          </span>
                          <span>•</span>
                          <span className="text-slate-600 font-mono">🔋 {state?.batteryVoltage || 13.8}V</span>
                        </div>
                      </div>
                    </div>

                    <ChevronLeft className="w-4 h-4 text-slate-400" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. MAP TAB (Full Interactive Map with Top Header and Return Button) */}
        {activeTab === 'map' && (
          <div className="space-y-3">
            {/* Map Top Action Header */}
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between gap-2">
              <button
                onClick={() => setActiveTab('home')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>بازگشت به پیشخوان</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>تاریخچه ۳۰ روز</span>
              </button>
            </div>

            {/* Vehicle Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {activeVehicles.map((v) => {
                const isSelected = selectedVehicleId === v.id;
                const state = currentStates.find((s) => s.vehicleId === v.id);
                const status = getStatusInfo(state);

                return (
                  <button
                    key={v.id}
                    onClick={() => onSelectVehicle(v.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${status.dotClass}`}></span>
                    <span className="font-mono">{v.plateNumber}</span>
                  </button>
                );
              })}
            </div>

            {/* Map Container */}
            <div className="h-[calc(100vh-210px)] rounded-xl overflow-hidden border border-slate-100 shadow-xs bg-white">
              <FleetMap
                vehicles={activeVehicles}
                currentStates={currentStates}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={onSelectVehicle}
                className="h-full"
              />
            </div>
          </div>
        )}

        {/* 3. HISTORY TAB (Up to 30 Days Replay & Analysis) */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-xs flex items-center justify-between">
              <button
                onClick={() => setActiveTab('map')}
                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                <span>بازگشت به نقشه زنده</span>
              </button>
              <span className="text-xs font-bold text-slate-800">بازپخش و تاریخچه ۳۰ روزه</span>
            </div>

            <TripHistoryView
              vehicles={activeVehicles}
              onLoadHistory={
                onLoadHistory ||
                (async () => [])
              }
            />
          </div>
        )}

        {/* 4. VEHICLES TAB */}
        {activeTab === 'vehicles' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">لیست موترها و سنسورهای زنده</h2>
              <button
                onClick={() => setActiveTab('map')}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>مشاهده روی نقشه</span>
              </button>
            </div>

            {activeVehicles.map((v) => {
              const state = currentStates.find((s) => s.vehicleId === v.id);
              const statusInfo = getStatusInfo(state);

              return (
                <div key={v.id} className="bg-white border border-slate-100 p-4 rounded-xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 font-mono">{v.plateNumber}</h3>
                      <p className="text-xs text-slate-500">{v.vehicleName}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border flex items-center gap-1.5 ${statusInfo.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`}></span>
                      <span>{statusInfo.label}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-3 rounded-lg border border-slate-100 text-xs text-slate-700">
                    <div>⚡ سرعت: <strong className="text-slate-900 font-mono">{state?.speed || 0}</strong> km/h</div>
                    <div>🔑 سویچ موتر: <strong className={state?.ignition ? 'text-emerald-700 font-bold' : 'text-slate-400'}>{state?.ignition ? 'روشن' : 'خاموش'}</strong></div>
                    <div>🔋 ولتاژ بطری: <strong className="text-slate-900 font-mono">{state?.batteryVoltage || 13.8}V</strong></div>
                    <div>📡 سیگنال آنتن: <strong className="text-slate-900 font-mono">{state?.gsmSignal || 0}%</strong></div>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="truncate">📍 {state?.address || 'کابل، افغانستان'}</span>
                    <button
                      onClick={() => {
                        onSelectVehicle(v.id);
                        setActiveTab('map');
                      }}
                      className="text-blue-600 font-bold text-[11px] hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <span>ردیابی روی نقشه</span>
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. ALERTS TAB */}
        {activeTab === 'alerts' && (
          <div className="space-y-2.5">
            <h2 className="text-xs font-bold text-slate-900 mb-2">هشدارهای ارسالی به موبایل شما</h2>
            {events.length === 0 ? (
              <div className="bg-white border border-slate-100 p-8 rounded-xl text-center text-slate-500 text-xs">
                هیچ هشدار امنیتی جدیدی ثبت نشده است.
              </div>
            ) : (
              events.map((ev) => (
                <div key={ev.id} className="bg-white border border-slate-100 p-3.5 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{ev.description}</span>
                    <span className="text-[11px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{ev.severity}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span>زمان: {new Date(ev.timestamp).toLocaleTimeString('fa-AF')}</span>
                    <span className="font-mono">{ev.speed ? `${ev.speed} km/h` : ''}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 6. ACCOUNT TAB */}
        {activeTab === 'account' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-100 p-5 rounded-xl text-center space-y-2 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-bold text-xl flex items-center justify-center mx-auto shadow-xs">
                {currentUser.fullName.slice(0, 1)}
              </div>
              <h2 className="text-sm font-bold text-slate-900">{currentUser.fullName}</h2>
              <p className="text-xs text-blue-600 font-medium">{currentUser.email}</p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              {onChangePassword && (
                <button
                  onClick={onChangePassword}
                  className="w-full bg-white border border-slate-200 p-3.5 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition shadow-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
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
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span>خروج از حساب کاربری</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-rose-400" />
                </button>
              )}
            </div>

            <div className="bg-white border border-slate-100 p-4 rounded-xl space-y-2.5 text-xs text-slate-600 shadow-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>وضعیت حساب:</span>
                <span className="text-emerald-600 font-bold">● فعال و متصل به ماهواره</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>زبان برنامه:</span>
                <span className="text-slate-900 font-semibold">فارسی / دری (RTL)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>پروتکل امنیتی:</span>
                <span className="text-blue-600 font-mono font-bold">Supabase Auth (PostgreSQL)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vehicle Quick Modal */}
      {activeVehicleModalId && activeModalVehicle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4 shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-mono">{activeModalVehicle.plateNumber}</h3>
                <p className="text-xs text-slate-500">{activeModalVehicle.vehicleName}</p>
              </div>
              <button
                onClick={() => setActiveVehicleModalId(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>سرعت فعلی: <strong className="text-slate-900 font-mono">{activeModalState?.speed || 0} km/h</strong></div>
              <div>سویچ: <strong className={activeModalState?.ignition ? 'text-emerald-700' : 'text-slate-400'}>{activeModalState?.ignition ? 'روشن' : 'خاموش'}</strong></div>
              <div>ولتاژ بطری: <strong className="text-slate-900 font-mono">{activeModalState?.batteryVoltage || 13.8}V</strong></div>
              <div>سیگنال مخابراتی: <strong className="text-slate-900 font-mono">{activeModalState?.gsmSignal || 0}%</strong></div>
            </div>

            <div className="text-xs text-slate-500">
              📍 {activeModalState?.address || 'کابل، افغانستان'}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  onSelectVehicle(activeModalVehicle.id);
                  setActiveVehicleModalId(null);
                  setActiveTab('map');
                }}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-4 h-4" />
                <span>نمایش روی نقشه</span>
              </button>
              <button
                onClick={() => {
                  onSelectVehicle(activeModalVehicle.id);
                  setActiveVehicleModalId(null);
                  setActiveTab('history');
                }}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <History className="w-4 h-4" />
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
        alertsCount={activeAlerts.length}
        activeVehiclesCount={activeVehicles.length}
      />
    </div>
  );
};
