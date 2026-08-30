/**
 * Fleet Overview Dashboard Stats Cards
 */
import React from 'react';
import { Car, Radio, Navigation, PauseCircle, Clock, AlertTriangle, BatteryCharging, Zap } from 'lucide-react';
import { VehicleStatus } from '../../shared/types/enums';
import { VehicleCurrentState, Vehicle, FleetEvent } from '../../shared/types/models';

interface OverviewStatsProps {
  vehicles: Vehicle[];
  currentStates: VehicleCurrentState[];
  events: FleetEvent[];
  onFilterStatus?: (status?: VehicleStatus) => void;
}

export const OverviewStats: React.FC<OverviewStatsProps> = ({
  vehicles,
  currentStates,
  events,
  onFilterStatus,
}) => {
  const totalVehicles = vehicles.length;
  const movingCount = currentStates.filter((s) => s.onlineStatus === VehicleStatus.MOVING).length;
  const stoppedCount = currentStates.filter((s) => s.onlineStatus === VehicleStatus.STOPPED).length;
  const idleCount = currentStates.filter((s) => s.onlineStatus === VehicleStatus.IDLE).length;
  const offlineCount = currentStates.filter((s) => s.onlineStatus === VehicleStatus.OFFLINE).length;
  const activeAlerts = events.filter((e) => !e.isAcknowledged).length;

  const totalDailyDistance = currentStates.reduce((acc, s) => acc + (s.speed > 0 ? 12 : 0), 0);

  const statCards = [
    {
      title: 'کل وسایط نقلیه',
      value: totalVehicles,
      subtitle: 'مجموع موترهای فعال',
      icon: Car,
      color: 'text-blue-600',
      badgeColor: 'text-blue-600',
      badgeText: '۱۰۰٪ ناوگان',
      status: undefined,
    },
    {
      title: 'در حال حرکت',
      value: movingCount,
      subtitle: 'سرعت بالای ۰ km/h',
      icon: Navigation,
      color: 'text-emerald-600',
      badgeColor: 'text-emerald-600',
      badgeText: `${Math.round((movingCount / (totalVehicles || 1)) * 100)}٪ فعال`,
      status: VehicleStatus.MOVING,
    },
    {
      title: 'متوقف (خاموش)',
      value: stoppedCount,
      subtitle: 'سویچ خاموش و پارک',
      icon: PauseCircle,
      color: 'text-slate-500',
      badgeColor: 'text-slate-500',
      badgeText: 'پارک شده',
      status: VehicleStatus.STOPPED,
    },
    {
      title: 'درجا روشن (Idle)',
      value: idleCount,
      subtitle: 'سویچ روشن بدون حرکت',
      icon: Clock,
      color: 'text-amber-600',
      badgeColor: 'text-amber-600',
      badgeText: 'آماده حرکت',
      status: VehicleStatus.IDLE,
    },
    {
      title: 'وسایط آفلاین',
      value: offlineCount,
      subtitle: 'عدم دریافت سیگنال GPS',
      icon: Radio,
      color: 'text-slate-400',
      badgeColor: 'text-slate-400',
      badgeText: 'بدون ارتباط',
      status: VehicleStatus.OFFLINE,
    },
    {
      title: 'هشدارهای جاری',
      value: activeAlerts,
      subtitle: 'سرعت، ساحه و اضطرار',
      icon: AlertTriangle,
      color: 'text-rose-600',
      badgeColor: 'text-rose-600',
      badgeText: activeAlerts > 0 ? 'نیاز به بررسی' : 'عادی',
      status: undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statCards.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <button
            key={idx}
            onClick={() => onFilterStatus && onFilterStatus(stat.status)}
            className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs text-right transition hover:border-slate-300 hover:shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between w-full mb-2">
                <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">{stat.title}</p>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="flex justify-between items-end my-1">
                <h2 className="text-2xl font-bold text-slate-900">{stat.value}</h2>
                <span className={`text-xs font-bold ${stat.badgeColor}`}>{stat.badgeText}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 truncate">{stat.subtitle}</p>
          </button>
        );
      })}
    </div>
  );
};
