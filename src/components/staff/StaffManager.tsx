import React, { useState, useEffect } from 'react';
import { UserCheck, Shield, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, UserPlus, Phone, Mail, UserX } from 'lucide-react';
import { UserProfile } from '../../lib/supabase';
import { globalAuthService } from '../../services/auth-service';

interface StaffManagerProps {
  currentAdmin: UserProfile;
}

export const StaffManager: React.FC<StaffManagerProps> = ({ currentAdmin }) => {
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'pending' | 'approved' | 'suspended'>('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStaff = async () => {
    setIsLoading(true);
    const list = await globalAuthService.getStaffList();
    setStaffList(list);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleApprove = async (staffId: string) => {
    setProcessingId(staffId);
    setFeedbackMsg(null);
    const success = await globalAuthService.approveStaff(staffId, currentAdmin.id);
    setProcessingId(null);
    if (success) {
      setFeedbackMsg({ type: 'success', text: 'دسترسی کارمند با موفقیت تایید و فعال شد.' });
      fetchStaff();
    } else {
      setFeedbackMsg({ type: 'error', text: 'خطا در تایید حساب کارمند.' });
    }
  };

  const handleSuspend = async (staffId: string) => {
    setProcessingId(staffId);
    setFeedbackMsg(null);
    const success = await globalAuthService.suspendStaff(staffId);
    setProcessingId(null);
    if (success) {
      setFeedbackMsg({ type: 'success', text: 'دسترسی کارمند با موفقیت تعلیق شد.' });
      fetchStaff();
    } else {
      setFeedbackMsg({ type: 'error', text: 'خطا در تعلیق حساب کارمند.' });
    }
  };

  const filteredStaff = staffList.filter((s) => {
    if (activeFilter === 'ALL') return true;
    return s.status === activeFilter;
  });

  const pendingCount = staffList.filter((s) => s.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">مدیریت پرسنل و کارمندان شرکت</h2>
              <p className="text-xs text-slate-500">بررسی درخواست‌های عضویت اپراتورها و تایید دسترسی سازمانی</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStaff}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>بروزرسانی لیست</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2 border ${
          feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Stats and Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveFilter('ALL')}
          className={`p-4 rounded-xl border text-right transition cursor-pointer ${
            activeFilter === 'ALL' ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <p className="text-xs text-slate-500 font-medium">کل پرسنل ثبت‌شده</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{staffList.length}</p>
        </button>

        <button
          onClick={() => setActiveFilter('pending')}
          className={`p-4 rounded-xl border text-right transition cursor-pointer relative ${
            activeFilter === 'pending' ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20' : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          {pendingCount > 0 && (
            <span className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
          )}
          <p className="text-xs text-amber-700 font-medium">در انتظار تایید مدیر</p>
          <p className="text-xl font-bold text-amber-900 mt-1">{pendingCount}</p>
        </button>

        <button
          onClick={() => setActiveFilter('approved')}
          className={`p-4 rounded-xl border text-right transition cursor-pointer ${
            activeFilter === 'approved' ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20' : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <p className="text-xs text-emerald-700 font-medium">فعال و تایید شده</p>
          <p className="text-xl font-bold text-emerald-900 mt-1">
            {staffList.filter((s) => s.status === 'approved').length}
          </p>
        </button>

        <button
          onClick={() => setActiveFilter('suspended')}
          className={`p-4 rounded-xl border text-right transition cursor-pointer ${
            activeFilter === 'suspended' ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20' : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <p className="text-xs text-rose-700 font-medium">تعلیق شده</p>
          <p className="text-xl font-bold text-rose-900 mt-1">
            {staffList.filter((s) => s.status === 'suspended').length}
          </p>
        </button>
      </div>

      {/* Staff Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            فهرست درخواست‌ها و کارمندان ({filteredStaff.length})
          </h3>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span>در حال دریافت لیست پرسنل از پایگاه داده...</span>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            هیچ کاربری با فیلتر انتخابی یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">کارمند / مدیر</th>
                  <th className="py-3.5 px-4">نام کاربری</th>
                  <th className="py-3.5 px-4">شماره تماس / ایمیل</th>
                  <th className="py-3.5 px-4">نقش</th>
                  <th className="py-3.5 px-4">وضعیت</th>
                  <th className="py-3.5 px-4">تاریخ ثبت‌نام</th>
                  <th className="py-3.5 px-4 text-center">عملیات مدیریت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          staff.role === 'super_admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {staff.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{staff.full_name}</p>
                          {staff.notes && <p className="text-[11px] text-slate-400">{staff.notes}</p>}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700 dir-ltr text-right">
                      {staff.username}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        {staff.phone && (
                          <div className="flex items-center gap-1 text-slate-700 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{staff.phone}</span>
                          </div>
                        )}
                        {staff.email && (
                          <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{staff.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                        staff.role === 'super_admin'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {staff.role === 'super_admin' ? 'مدیر ارشد' : 'کارمند اپراتور'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 ${
                        staff.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : staff.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {staff.status === 'approved' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {staff.status === 'pending' && <Clock className="w-3 h-3 text-amber-600" />}
                        {staff.status === 'suspended' && <XCircle className="w-3 h-3 text-rose-600" />}
                        <span>
                          {staff.status === 'approved' ? 'تایید شده (فعال)' : staff.status === 'pending' ? 'در انتظار تایید' : 'تعلیق شده'}
                        </span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(staff.created_at).toLocaleDateString('fa-IR')}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {staff.id === currentAdmin.id ? (
                        <span className="text-[11px] text-slate-400 font-medium">حساب فعلی شما</span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          {staff.status !== 'approved' && (
                            <button
                              onClick={() => handleApprove(staff.id)}
                              disabled={processingId === staff.id}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[11px] transition shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="تایید و فعال‌سازی دسترسی"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تایید دسترسی</span>
                            </button>
                          )}

                          {staff.status === 'approved' && (
                            <button
                              onClick={() => handleSuspend(staff.id)}
                              disabled={processingId === staff.id}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold text-[11px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="قطع دسترسی و تعلیق"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>تعلیق حساب</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
