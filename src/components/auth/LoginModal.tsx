import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { globalAuthService } from '../../services/auth-service';
import { UserProfile } from '../../lib/supabase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: UserProfile) => void;
  onOpenStaffRegister: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenStaffRegister,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('لطفاً نام کاربری/شماره تماس و رمز عبور را وارد کنید');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const { profile, error } = await globalAuthService.signIn(identifier, password);
    setIsLoading(false);

    if (error || !profile) {
      setErrorMsg(error || 'ورود ناموفق بود. لطفاً اطلاعات را مجدداً بررسی کنید.');
    } else {
      onSuccess(profile);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 text-white/80 hover:text-white transition p-1"
          >
            ✕
          </button>
          <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
            <Shield className="w-8 h-8 text-blue-200" />
          </div>
          <h2 className="text-xl font-bold">ورود به سامانه ردیابی ناوگان</h2>
          <p className="text-xs text-blue-100 mt-1">مدیران، کارمندان شرکت و مالکان وسایط نقلیه</p>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-right">
              نام کاربری، شماره تماس یا ایمیل
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                dir="ltr"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="0799123456 / username"
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden transition text-left"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 text-right">
              مشتریان می‌توانند با همان شماره تماس یا نام کاربری تحویل‌گرفته وارد شوند.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-right">
              رمز عبور
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden transition text-left"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition duration-150 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال بررسی هویت...</span>
              </>
            ) : (
              <>
                <span>ورود به پنل کاربری</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer / Subtle Staff Registration Link */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <KeyRound className="w-3.5 h-3.5 text-slate-400" />
            <span>پایگاه داده: Supabase PostgreSQL</span>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenStaffRegister();
            }}
            className="text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
          >
            ثبت‌نام پرسنل / مدیر
          </button>
        </div>

      </div>
    </div>
  );
};
