/**
 * Top Navigation Header
 * Features Afghan GPS branding, live gateway indicator, role switcher, Supabase Auth buttons, and alert notifications.
 */
import React from 'react';
import { Bell, RefreshCw, LogIn, LogOut, KeyRound, UserPlus } from 'lucide-react';
import { UserRole } from '../../shared/types/enums';
import { User } from '../../shared/types/models';
import { UserProfile } from '../../lib/supabase';

interface HeaderProps {
  currentUser: User;
  currentProfile?: UserProfile | null;
  onSwitchRole: (role: UserRole) => void;
  activeAlertsCount: number;
  onRefresh: () => void;
  isMobileView: boolean;
  onToggleMobileView: () => void;
  onOpenLogin: () => void;
  onOpenStaffRegister: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  currentProfile,
  onSwitchRole,
  activeAlertsCount,
  onRefresh,
  isMobileView,
  onToggleMobileView,
  onOpenLogin,
  onOpenStaffRegister,
  onChangePassword,
  onLogout,
}) => {
  const isSuperAdmin = currentProfile?.role === 'super_admin' || currentUser.role === UserRole.SUPER_ADMIN;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs">
      {/* Brand Title */}
      <div className="flex items-center">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          سامانه ردیابی
        </h1>
      </div>

      {/* Controls & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Manual Refresh */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          title="بروزرسانی زنده داده‌ها"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Alerts Badge */}
        <div className="relative">
          <button className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-xs cursor-pointer">
            <Bell className="w-4 h-4" />
          </button>
          {activeAlertsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
              {activeAlertsCount}
            </span>
          )}
        </div>

        {/* Subtle Staff Registration Button (only for super_admin / managers) */}
        {isSuperAdmin && (
          <button
            onClick={onOpenStaffRegister}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition cursor-pointer"
            title="ثبت‌نام پرسنل یا مدیر جدید"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-500" />
            <span>ثبت‌نام پرسنل</span>
          </button>
        )}

        {/* Role Switcher */}
        <div className="hidden xl:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
          <button
            onClick={() => onSwitchRole(UserRole.SUPER_ADMIN)}
            className={`text-xs px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
              currentUser.role === UserRole.SUPER_ADMIN
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مدیر سیستم
          </button>
          <button
            onClick={() => onSwitchRole(UserRole.CUSTOMER)}
            className={`text-xs px-2.5 py-1 rounded-md transition font-medium cursor-pointer ${
              currentUser.role === UserRole.CUSTOMER
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مشتری
          </button>
        </div>

        {/* User Card / Login Action */}
        {currentProfile ? (
          <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-slate-200">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-900 leading-tight">{currentProfile.full_name}</p>
              <p className="text-[11px] text-slate-500 font-mono">
                {currentProfile.username ? `@${currentProfile.username}` : ''}
              </p>
            </div>
            <button
              onClick={onChangePassword}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
              title="تغییر رمز عبور"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              title="خروج از حساب"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>ورود به سامانه</span>
          </button>
        )}
      </div>
    </header>
  );
};
