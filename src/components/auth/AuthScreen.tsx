import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, ArrowLeft, Loader2, KeyRound, Radio, CheckCircle2, UserPlus } from 'lucide-react';
import { globalAuthService } from '../../services/auth-service';
import { UserProfile } from '../../lib/supabase';

interface AuthScreenProps {
  onSuccess: (profile: UserProfile) => void;
  onOpenStaffRegister: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onSuccess,
  onOpenStaffRegister,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('لطفاً نام کاربری/شماره تماس و رمز عبور را وارد کنید.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { profile, error } = await globalAuthService.signIn(identifier, password);
      setIsLoading(false);

      if (error || !profile) {
        setErrorMsg(error || 'نام کاربری یا رمز عبور اشتباه است.');
      } else {
        onSuccess(profile);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'خطا در برقراری ارتباط با سرور.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white" dir="rtl">
      {/* Top Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">سامانه ملی ردیابی ناوگان GPS</h1>
            <p className="text-[11px] text-slate-400">جمهوری اسلامی افغانستان • امنیت و تلمتری وسایط</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-400 font-medium font-mono">سرور آنلاین (TCP 5001 / UDP 5002)</span>
        </div>
      </header>

      {/* Main Center Auth Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          
          {/* Card Banner */}
          <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-7 text-white text-center relative">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
              <Shield className="w-9 h-9 text-blue-200" />
            </div>
            <h2 className="text-lg font-bold">ورود به سامانه ردیابی و مانیتورینگ</h2>
            <p className="text-xs text-blue-100 mt-1">
              دسترسی امن مدیران، اپراتورها و مالکان وسایط نقلیه
            </p>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-right">
                نام کاربری، شماره موبایل یا ایمیل
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  dir="ltr"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="0799123456 / admin / username"
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden transition text-left"
                  required
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1 text-right">
                مشتریان با همان شماره تماس ثبت‌شده توسط شرکت وارد می‌شوند.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-right">
                رمز عبور
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden transition text-left"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition duration-150 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال بررسی هویت و اتصال به Supabase...</span>
                </>
              ) : (
                <>
                  <span>ورود به حساب کاربری</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Registration and DB Status */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              <span>پایگاه داده Supabase PostgreSQL</span>
            </div>

            <button
              type="button"
              onClick={onOpenStaffRegister}
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>ثبت‌نام پرسنل یا مدیر جدید</span>
            </button>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-3 text-center text-xs text-slate-500 border-t border-slate-800/80 bg-slate-950/40">
        سامانه جامع ردیابی ماهواره‌ای ناوگان حمل‌ونقل • اتصال بلادرنگ به پروتکل‌های GT06 / Coban / Teltonika / JT808
      </footer>
    </div>
  );
};
