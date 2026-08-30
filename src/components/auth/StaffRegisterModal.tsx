import React, { useState } from 'react';
import { UserCheck, Shield, Phone, Mail, Lock, User, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { globalAuthService } from '../../services/auth-service';
import { UserProfile } from '../../lib/supabase';

interface StaffRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: UserProfile) => void;
  onOpenLogin: () => void;
}

export const StaffRegisterModal: React.FC<StaffRegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenLogin,
}) => {
  const [role, setRole] = useState<'staff' | 'super_admin'>('staff');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !phone.trim() || !password.trim()) {
      setErrorMsg('لطفاً تمام فیلدهای ستاره‌دار را تکمیل کنید');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('رمز عبور و تکرار آن با یکدیگر مطابقت ندارند');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('رمز عبور باید حداقل ۶ کاراکتر باشد');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const { profile, error } = await globalAuthService.registerStaffOrAdmin({
      username,
      fullName,
      phone,
      email: email.trim() || undefined,
      password,
      role,
      notes,
    });

    setIsLoading(false);

    if (error || !profile) {
      setErrorMsg(error || 'خطا در ثبت نام. لطفاً مجدداً تلاش نمایید.');
    } else {
      onSuccess(profile);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 text-white/80 hover:text-white transition p-1"
          >
            ✕
          </button>
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center mx-auto mb-2 border border-white/20">
            <UserCheck className="w-6 h-6 text-blue-300" />
          </div>
          <h2 className="text-lg font-bold">ثبت‌نام پرسنل و مدیران سامانه</h2>
          <p className="text-xs text-slate-300 mt-1">
            دسترسی پس از بررسی توسط مدیر ارشد فعال خواهد شد
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Role Choice */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setRole('staff')}
              className={`py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                role === 'staff'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>کارمند / اپراتور</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('super_admin')}
              className={`py-2 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                role === 'super_admin'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>مدیر ارشد (Super Admin)</span>
            </button>
          </div>

          {role === 'super_admin' && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] leading-relaxed">
              ⚠️ <strong>توجه:</strong> ثبت‌نام مدیر ارشد نیازمند فعال‌سازی دستی در دیتابیس Supabase (تغییر وضعیت از <code className="bg-amber-100 px-1 py-0.5 rounded">pending</code> به <code className="bg-amber-100 px-1 py-0.5 rounded">approved</code> در جدول profiles) می‌باشد.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                نام و تخلص کامل *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: احمد شاه مسعود"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                نام کاربری (لاتین) *
              </label>
              <input
                type="text"
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ahmad_ops"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                شماره تماس (افغانستان) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0799123456"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ایمیل (اختیاری)
              </label>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@company.af"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                رمز عبور *
              </label>
              <input
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="حداقل ۶ کاراکتر"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                تکرار رمز عبور *
              </label>
              <input
                type="password"
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="تکرار رمز عبور"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              توضیحات یا بخش کاری (اختیاری)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: بخش پشتیبانی و تعریف ردیاب‌ها"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition duration-150 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>در حال ارسال اطلاعات...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>ارسال درخواست ثبت‌نام</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLogin();
            }}
            className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
          >
            ورود به حساب
          </button>
        </div>

      </div>
    </div>
  );
};
