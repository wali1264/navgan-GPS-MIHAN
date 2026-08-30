/**
 * Desktop Admin Sidebar Navigation
 */
import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  Car,
  Cpu,
  Users,
  Building2,
  History,
  ShieldAlert,
  Bell,
  FileSpreadsheet,
  Terminal,
  Activity,
  Wrench,
  FileText,
  Radio,
  ChevronLeft,
  UserCheck,
} from 'lucide-react';
import { UserRole } from '../../shared/types/enums';

export type NavTab =
  | 'dashboard'
  | 'map'
  | 'vehicles'
  | 'devices'
  | 'drivers'
  | 'customers'
  | 'staff'
  | 'history'
  | 'geofences'
  | 'events'
  | 'reports'
  | 'commands'
  | 'diagnostics'
  | 'maintenance'
  | 'audit';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userRole: UserRole;
  activeVehiclesCount: number;
  alertsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  userRole,
  activeVehiclesCount,
  alertsCount,
}) => {
  const isAdmin = userRole === UserRole.SUPER_ADMIN || userRole === UserRole.COMPANY_ADMIN;

  const menuItems = [
    { id: 'dashboard', label: 'پیشخوان مدیریتی', icon: LayoutDashboard },
    { id: 'map', label: 'نقشه و ردیابی زنده', icon: MapPin, badge: activeVehiclesCount },
    { id: 'vehicles', label: 'وسایط نقلیه', icon: Car },
    ...(isAdmin ? [{ id: 'devices', label: 'دستگاه‌های GPS', icon: Cpu }] : []),
    { id: 'history', label: 'تاریخچه و بازپخش مسیر', icon: History },
    { id: 'geofences', label: 'محدوده‌های جغرافیایی', icon: ShieldAlert },
    { id: 'events', label: 'رویدادها و هشدارها', icon: Bell, badge: alertsCount > 0 ? alertsCount : undefined, badgeColor: 'bg-rose-500' },
    { id: 'reports', label: 'گزارش‌های دوره‌ای', icon: FileSpreadsheet },
    ...(isAdmin ? [{ id: 'drivers', label: 'درایوران و رانندگان', icon: Users }] : []),
    ...(isAdmin ? [{ id: 'customers', label: 'مدیریت مشتریان و مشترکین', icon: Building2 }] : []),
    ...(userRole === UserRole.SUPER_ADMIN ? [{ id: 'staff', label: 'پرسنل و تایید دسترسی', icon: UserCheck }] : []),
    ...(isAdmin ? [{ id: 'commands', label: 'ارسال دستورات (Commands)', icon: Terminal }] : []),
    ...(isAdmin ? [{ id: 'diagnostics', label: 'عیب‌یابی پکت‌ها و سرور', icon: Activity }] : []),
    { id: 'maintenance', label: 'مراقبت و سرویس موتر', icon: Wrench },
    ...(isAdmin ? [{ id: 'audit', label: 'لاگ فعالیت‌ها (Audit Log)', icon: FileText }] : []),
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
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white ${
                    item.badgeColor || 'bg-blue-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Gateway Port Status Info */}
      <div className="p-4 border-t border-slate-700/50 bg-[#0F172A]/40 text-slate-400 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px]">گیت‌وی TCP:</span>
          <span className="font-mono text-emerald-400 font-bold text-[11px]">5001 (GT06)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px]">گیت‌وی UDP:</span>
          <span className="font-mono text-emerald-400 font-bold text-[11px]">5002 (TK103)</span>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/40 text-[11px]">
          <span className="text-slate-400">سرور عملیاتی:</span>
          <span className="text-blue-400 font-mono">gps.afggps.af</span>
        </div>
      </div>
    </aside>
  );
};
