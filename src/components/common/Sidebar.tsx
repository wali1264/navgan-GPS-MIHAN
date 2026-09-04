/**
 * Desktop Admin Sidebar Navigation
 */
import React from 'react';
import {
  MapPin,
  Car,
  Cpu,
  Building2,
  History,
  UserCheck,
} from 'lucide-react';
import { UserRole } from '../../shared/types/enums';

export type NavTab =
  | 'map'
  | 'vehicles'
  | 'customers'
  | 'devices'
  | 'history'
  | 'staff';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: NavTab) => void;
  userRole: UserRole;
  activeVehiclesCount: number;
  alertsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  userRole,
  activeVehiclesCount,
}) => {
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;

  const menuItems = [
    { id: 'map', label: 'نقشه و ردیابی زنده', icon: MapPin, badge: activeVehiclesCount },
    { id: 'vehicles', label: 'وسایط نقلیه', icon: Car },
    { id: 'customers', label: 'مدیریت مشتریان و مشترکین', icon: Building2 },
    { id: 'devices', label: 'دستگاه‌های GPS', icon: Cpu },
    { id: 'history', label: 'تاریخچه و بازپخش مسیر', icon: History },
    ...(isSuperAdmin ? [{ id: 'staff', label: 'پرسنل و تایید دسترسی', icon: UserCheck }] : []),
  ];

  return (
    <aside className="w-64 bg-[#1E293B] border-l border-slate-700/50 flex flex-col h-[calc(100vh-61px)] sticky top-[61px] text-slate-300">
      <div className="p-4 border-b border-slate-700/50">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">منوی اصلی سامانه</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id as NavTab)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition ${
                isActive
                  ? 'bg-slate-700/60 text-white font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white bg-blue-600">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
