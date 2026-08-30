/**
 * Dedicated Customer Mobile Experience
 * Designed specifically for smartphone screens with touch gestures, quick vehicle status, and live map view.
 */
import React, { useState } from 'react';
import { Vehicle, VehicleCurrentState, FleetEvent, User } from '../../shared/types/models';
import { MobileNav, MobileTab } from '../common/MobileNav';
import { FleetMap } from '../map/FleetMap';
import { Car, Navigation, Shield, Key, Battery, Signal, Bell, Phone, MapPin, Gauge, ChevronLeft, PowerOff, CheckCircle } from 'lucide-react';
import { VehicleStatus } from '../../shared/types/enums';

interface CustomerMobileViewProps {
  currentUser: User;
  vehicles: Vehicle[];
  currentStates: VehicleCurrentState[];
  events: FleetEvent[];
  onSelectVehicle: (vehicleId: string) => void;
  selectedVehicleId?: string;
}

export const CustomerMobileView: React.FC<CustomerMobileViewProps> = ({
  currentUser,
  vehicles,
  currentStates,
  events,
  onSelectVehicle,
  selectedVehicleId,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [activeVehicleModalId, setActiveVehicleModalId] = useState<string | null>(null);

  const activeVehicles = vehicles;
  const activeAlerts = events.filter((e) => !e.isAcknowledged);

  const activeModalVehicle = vehicles.find((v) => v.id === activeVehicleModalId);
  const activeModalState = currentStates.find((s) => s.vehicleId === activeVehicleModalId);

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
          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
            ● GPS زنده
          </span>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 p-4">
        {/* 1. HOME TAB */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Quick Map Widget */}
            <div className="h-56 rounded-xl overflow-hidden border border-slate-100 shadow-xs relative bg-white">
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
                className="absolute bottom-2 left-2 z-[400] bg-white/95 text-blue-600 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-1"
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

            {/* Vehicles Cards Carousel */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-900">وضعیت زنده موترها</h2>
                <button onClick={() => setActiveTab('vehicles')} className="text-xs text-blue-600 font-medium">
                  مشاهده همه
                </button>
              </div>

              {activeVehicles.map((v) => {
                const state = currentStates.find((s) => s.vehicleId === v.id);

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
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{v.plateNumber}</span>
                          <span className="text-[11px] text-slate-500">({v.vehicleName})</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>⚡ {state?.speed || 0} km/h</span>
                          <span>•</span>
                          <span className={state?.ignition ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                            {state?.ignition ? 'سویچ روشن' : 'خاموش'}
                          </span>
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

        {/* 2. MAP TAB */}
        {activeTab === 'map' && (
          <div className="h-[calc(100vh-140px)] rounded-xl overflow-hidden border border-slate-100 shadow-xs bg-white">
            <FleetMap
              vehicles={activeVehicles}
              currentStates={currentStates}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={onSelectVehicle}
              className="h-full"
            />
          </div>
        )}

        {/* 3. VEHICLES TAB */}
        {activeTab === 'vehicles' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-900">لیست تمام موترها و جزئیات تلمتری</h2>
            {activeVehicles.map((v) => {
              const state = currentStates.find((s) => s.vehicleId === v.id);

              return (
                <div key={v.id} className="bg-white border border-slate-100 p-4 rounded-xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{v.plateNumber}</h3>
                      <p className="text-xs text-slate-500">{v.vehicleName}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {state?.onlineStatus || 'OFFLINE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-3 rounded-lg border border-slate-100 text-xs text-slate-700">
                    <div>سرعت: <strong className="text-slate-900 font-mono">{state?.speed || 0}</strong> km/h</div>
                    <div>سویچ: <strong className={state?.ignition ? 'text-emerald-700' : 'text-slate-400'}>{state?.ignition ? 'روشن' : 'خاموش'}</strong></div>
                    <div>ولتاژ بطری: <strong className="text-slate-900 font-mono">{state?.batteryVoltage || 12.6}V</strong></div>
                    <div>سیگنال مخابراتی: <strong className="text-slate-900 font-mono">{state?.gsmSignal || 80}%</strong></div>
                  </div>

                  <div className="text-xs text-slate-500 truncate">
                    📍 {state?.address || 'کابل، افغانستان'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. ALERTS TAB */}
        {activeTab === 'alerts' && (
          <div className="space-y-2.5">
            <h2 className="text-xs font-bold text-slate-900 mb-2">هشدارهای ارسالی به موبایل شما</h2>
            {events.map((ev) => (
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
            ))}
          </div>
        )}

        {/* 5. ACCOUNT TAB */}
        {activeTab === 'account' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-100 p-5 rounded-xl text-center space-y-2 shadow-xs">
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-bold text-xl flex items-center justify-center mx-auto shadow-xs">
                {currentUser.fullName.slice(0, 1)}
              </div>
              <h2 className="text-sm font-bold text-slate-900">{currentUser.fullName}</h2>
              <p className="text-xs text-blue-600 font-medium">{currentUser.email}</p>
            </div>

            <div className="bg-white border border-slate-100 p-4 rounded-xl space-y-2.5 text-xs text-slate-600 shadow-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>سازمان / شرکت:</span>
                <span className="text-slate-900 font-semibold">کابل لوجستیک افغانستان</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>زبان برنامه:</span>
                <span className="text-slate-900 font-semibold">فارسی / دری (RTL)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>نسخه اپلیکیشن:</span>
                <span className="text-blue-600 font-mono font-bold">v1.2.0 (Capacitor Android)</span>
              </div>
            </div>
          </div>
        )}
      </div>

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
