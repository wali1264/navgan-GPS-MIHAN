/**
 * Events & Security Alerts Feed View
 */
import React, { useState } from 'react';
import { FleetEvent, Vehicle } from '../../shared/types/models';
import { EventSeverity, EventType } from '../../shared/types/enums';
import { Bell, AlertTriangle, AlertCircle, Info, Check, ShieldAlert, Key, Gauge, Zap } from 'lucide-react';

interface EventsAlertsViewProps {
  events: FleetEvent[];
  vehicles: Vehicle[];
  onAcknowledge: (eventId: string) => void;
}

export const EventsAlertsView: React.FC<EventsAlertsViewProps> = ({ events, vehicles, onAcknowledge }) => {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [vehicleFilter, setVehicleFilter] = useState<string>('');

  const filteredEvents = events.filter((e) => {
    const matchesSeverity = severityFilter === 'ALL' || e.severity === severityFilter;
    const matchesVehicle = !vehicleFilter || e.vehicleId === vehicleFilter;
    return matchesSeverity && matchesVehicle;
  });

  const getSeverityBadge = (severity: EventSeverity) => {
    switch (severity) {
      case EventSeverity.CRITICAL:
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case EventSeverity.WARNING:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case EventType.OVERSPEED:
        return Gauge;
      case EventType.IGNITION_ON:
      case EventType.IGNITION_OFF:
        return Key;
      case EventType.GEOFENCE_ENTER:
      case EventType.GEOFENCE_EXIT:
        return ShieldAlert;
      case EventType.SOS:
        return AlertTriangle;
      case EventType.LOW_BATTERY:
        return Zap;
      default:
        return Bell;
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">فید رویدادها و هشدارهای امنیتی زنده</h2>
          <p className="text-xs text-slate-500 mt-0.5">ثبت آنی تمام تخلفات سرعت، ورود/خروج محدوده، سویچ و آلارم‌های SOS</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Vehicle Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs">
            <span className="text-slate-500 font-medium">موتر:</span>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">همه وسایط</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} ({v.vehicleName})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setSeverityFilter('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition shadow-xs ${
              severityFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            همه رویدادها
          </button>
          <button
            onClick={() => setSeverityFilter(EventSeverity.CRITICAL)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition shadow-xs ${
              severityFilter === EventSeverity.CRITICAL
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
          >
            بحرانی (SOS)
          </button>
          <button
            onClick={() => setSeverityFilter(EventSeverity.WARNING)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition shadow-xs ${
              severityFilter === EventSeverity.WARNING
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
            }`}
          >
            هشدارها (Warning)
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-2.5">
        {filteredEvents.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-xl border border-slate-100 shadow-xs text-slate-500 text-xs">
            هیچ هشداری در این دسته‌بندی یافت نشد. وضعیت ناوگان در حالت عادی است.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const vehicle = vehicles.find((v) => v.id === ev.vehicleId);
            const Icon = getEventIcon(ev.type);

            return (
              <div
                key={ev.id}
                className={`p-4 rounded-xl border flex items-center justify-between gap-3 transition shadow-xs ${
                  ev.isAcknowledged
                    ? 'bg-slate-50/70 border-slate-100 opacity-80'
                    : 'bg-white border-slate-200/90'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 rounded-lg border ${getSeverityBadge(ev.severity)}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{ev.description}</span>
                      <span className="text-[11px] text-blue-600 font-mono font-bold bg-blue-50 px-1.5 py-0.5 rounded">
                        {vehicle ? vehicle.plateNumber : 'موتر'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>زمان: {new Date(ev.timestamp).toLocaleTimeString('fa-AF')}</span>
                      <span>موقعیت: {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}</span>
                      {ev.speed !== undefined && <span>سرعت: <strong className="text-slate-700">{ev.speed}</strong> km/h</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {ev.isAcknowledged ? (
                    <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      بررسی شده
                    </span>
                  ) : (
                    <button
                      onClick={() => onAcknowledge(ev.id)}
                      className="px-3 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 text-xs font-medium transition border border-emerald-200 shadow-xs flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تایید بررسی</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
