import React, { useState } from 'react';
import { Clock, ShieldAlert, RefreshCw, LogOut, Phone, Shield } from 'lucide-react';
import { UserProfile } from '../../lib/supabase';
import { globalAuthService } from '../../services/auth-service';

interface PendingApprovalScreenProps {
  profile: UserProfile;
  onRefreshProfile: () => Promise<void>;
  onLogout: () => void;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({
  profile,
  onRefreshProfile,
  onLogout,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  const handleRecheck = async () => {
    setIsChecking(true);
    setCheckMsg(null);
    await onRefreshProfile();
    setIsChecking(false);
    setCheckMsg('بررسی انجام شد.');
  };

  const isSuspended = profile.status === 'suspended';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-center animate-in fade-in duration-300">
        
        {/* Banner */}
        <div className={`p-8 ${isSuspended ? 'bg-rose-700' : 'bg-amber-600'} text-white`}>
          <div className="w-16 h-16 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
            {isSuspended ? (
              <ShieldAlert className="w-9 h-9 text-rose-100" />
            ) : (
              <Clock className="w-9 h-9 text-amber-100" />
            )}
          </div>
          <h2 className="text-2xl font-bold">
            {isSuspended ? 'حساب کاربری تعلیق شده است' : 'در انتظار تایید مدیر سامانه'}
          </h2>
          <p className="text-sm text-white/90 mt-1.5 font-medium">
            {isSuspended
              ? 'دسترسی شما توسط مدیر ارشد به صورت موقت غیرفعال شده است'
              : 'درخواست عضویت پرسنل با موفقیت در پایگاه داده ثبت شد'}
          </p>
        </div>

        {/* Details Content */}
        <div className="p-6 sm:p-8 space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right text-xs space-y-2.5">
            <div className="flex items-center justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">نام و تخلص:</span>
              <span className="font-bold text-slate-800">{profile.full_name}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">نام کاربری:</span>
              <span className="font-bold text-slate-800 dir-ltr">{profile.username}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-200">
              <span className="text-slate-500">نقش درخواستی:</span>
              <span className="font-bold text-blue-700">
                {profile.role === 'super_admin' ? 'مدیر ارشد (Super Admin)' : 'کارمند / اپراتور سیستم'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">وضعیت دسترسی:</span>
              <span className={`font-bold px-2 py-0.5 rounded-md ${isSuspended ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                {isSuspended ? 'تعلیق شده (Suspended)' : 'در انتظار بررسی (Pending)'}
              </span>
            </div>
          </div>

          {profile.role === 'super_admin' && !isSuspended ? (
            <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs text-right leading-relaxed">
              <div className="flex items-center gap-2 font-bold mb-1">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>راهنمای فعال‌سازی اکانت مدیر ارشد:</span>
              </div>
              <p>
                وارد داشبورد <strong>Supabase</strong> شوید، جدول <strong>profiles</strong> را باز کرده و ستون <strong>status</strong> اکانت خود را از <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">pending</code> به <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">approved</code> تغییر دهید. سپس روی دکمه «بررسی مجدد» زیر کلیک کنید.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-600 leading-relaxed text-right">
              مدیر ارشد سامانه درخواست شما را در پنل مدیریت مشاهده خواهد کرد و پس از احراز هویت، دسترسی اپراتوری شما را آزاد می‌سازد.
            </p>
          )}

          {checkMsg && (
            <p className="text-xs text-slate-500 animate-pulse">{checkMsg}</p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleRecheck}
              disabled={isChecking}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>بررسی مجدد وضعیت حساب</span>
            </button>

            <button
              onClick={onLogout}
              className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>خروج از حساب</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-center gap-2">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          <span>پشتیبانی مرکزی سامانه ناوگان میهن افغانستان</span>
        </div>

      </div>
    </div>
  );
};
