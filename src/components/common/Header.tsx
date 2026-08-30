/**
 * Top Navigation Header
 * Features Afghan GPS branding, live gateway indicator, role switcher, and alert notifications.
 */
import React from 'react';
import { Shield, Radio, Bell, UserCheck, RefreshCw } from 'lucide-react';
import { UserRole } from '../../shared/types/enums';
import { User } from '../../shared/types/models';

interface HeaderProps {
  currentUser: User;
  onSwitchRole: (role: UserRole) => void;
  activeAlertsCount: number;
  onRefresh: () => void;
  isMobileView: boolean;
  onToggleMobileView: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSwitchRole,
  activeAlertsCount,
  onRefresh,
  isMobileView,
  onToggleMobileView,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-3 flex items-center justify-between shadow-xs">
      {/* Brand & Organization Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-xs">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">سامانه ملی ردیابی ناوگان GPS</h1>
            <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[11px] px-2 py-0.5 rounded-md font-medium hidden sm:inline-block">
              افغانستان
            </span>
          </div>
          <p className="text-xs text-slate-500">نظارت بلادرنگ و تلمتری وسایط نقلیه تجارتی و سازمانی</p>
        </div>
      </div>

      {/* Controls & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Gateway Active Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>گیت‌وی فعال (TCP 5001 / UDP 5002)</span>
        </div>

        {/* Mobile / Desktop Experience Toggle */}
        <button
          onClick={onToggleMobileView}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition flex items-center gap-1.5 shadow-xs ${
            isMobileView
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {isMobileView ? 'نمای دسکتاپ ادمین' : 'نمای موبایل مشتری'}
        </button>

        {/* Manual Refresh */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-xs"
          title="بروزرسانی زنده داده‌ها"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Alerts Badge */}
        <div className="relative">
          <button className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-xs">
            <Bell className="w-4 h-4" />
          </button>
          {activeAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
              {activeAlertsCount}
            </span>
          )}
        </div>

        {/* Role Switcher */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
          <button
            onClick={() => onSwitchRole(UserRole.SUPER_ADMIN)}
            className={`text-xs px-2.5 py-1 rounded-md transition font-medium ${
              currentUser.role === UserRole.SUPER_ADMIN
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مدیر سیستم
          </button>
          <button
            onClick={() => onSwitchRole(UserRole.CUSTOMER)}
            className={`text-xs px-2.5 py-1 rounded-md transition font-medium ${
              currentUser.role === UserRole.CUSTOMER
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مشتری
          </button>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-2.5 pr-3 border-r border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="hidden xl:block text-right">
            <p className="text-xs font-bold text-slate-900 leading-tight">{currentUser.fullName}</p>
            <p className="text-[11px] text-slate-500">{currentUser.role === UserRole.SUPER_ADMIN ? 'مدیر ارشد عملیات' : 'مشتری ناوگان'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

