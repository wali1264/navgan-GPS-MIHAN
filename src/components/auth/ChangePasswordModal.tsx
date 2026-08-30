import React, { useState } from 'react';
import { KeyRound, Lock, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { supabase, UserProfile } from '../../lib/supabase';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: UserProfile;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setStatusMsg({ type: 'error', text: 'لطفاً تمام فیلدها را تکمیل نمایید.' });
      return;
    }

    if (newPassword.length < 6) {
      setStatusMsg({ type: 'error', text: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'رمز عبور جدید و تکرار آن با یکدیگر مطابقت ندارند.' });
      return;
    }

    setIsLoading(true);
    setStatusMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      setIsLoading(false);

      if (error) {
        setStatusMsg({ type: 'error', text: error.message || 'خطا در تغییر رمز عبور.' });
      } else {
        setStatusMsg({ type: 'success', text: 'رمز عبور شما با موفقیت به‌روزرسانی شد.' });
        setTimeout(() => {
          onClose();
          setNewPassword('');
          setConfirmPassword('');
          setStatusMsg(null);
        }, 1500);
      }
    } catch (err: any) {
      setIsLoading(false);
      setStatusMsg({ type: 'error', text: err.message || 'خطای پیش‌بینی نشده.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <KeyRound className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold">تغییر رمز عبور حساب</h3>
              <p className="text-[11px] text-slate-300">کاربر: {currentProfile.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {statusMsg && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-right">
              رمز عبور جدید *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="حداقل ۶ کاراکتر"
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden transition text-left"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-right">
              تکرار رمز عبور جدید *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="تکرار رمز عبور جدید"
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden transition text-left"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ذخیره...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ثبت رمز عبور جدید</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
