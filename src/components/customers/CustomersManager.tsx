import React, { useState, useEffect } from 'react';
import { Customer, Vehicle } from '../../shared/types/models';
import { Building2, Phone, Mail, MapPin, Car, Plus, Search, UserPlus, Shield, CheckCircle2, AlertCircle, Loader2, Edit2, Trash2 } from 'lucide-react';
import { globalAuthService } from '../../services/auth-service';
import { UserProfile } from '../../lib/supabase';

interface CustomersManagerProps {
  customers: Customer[];
  vehicles: Vehicle[];
  currentAdmin?: UserProfile;
  onUpdateCustomer?: (id: string, updates: { fullName?: string; phone?: string; notes?: string }) => Promise<{ success: boolean; error?: string } | any> | void;
  onDeleteCustomer?: (id: string) => Promise<{ success: boolean; error?: string } | any> | void;
}

export const CustomersManager: React.FC<CustomersManagerProps> = ({
  customers,
  vehicles,
  currentAdmin,
  onUpdateCustomer,
  onDeleteCustomer,
}) => {
  const [clientProfiles, setClientProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Deletion State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchClientProfiles = async () => {
    setIsLoading(true);
    const list = await globalAuthService.getClientsList();
    setClientProfiles(list);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClientProfiles();
  }, []);

  const openAddModal = () => {
    setEditingClientId(null);
    setFullName('');
    setUsername('');
    setPhone('');
    setPassword('');
    setNotes('');
    setFormMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (client: UserProfile) => {
    setEditingClientId(client.id);
    setFullName(client.full_name || '');
    setUsername(client.username || '');
    setPhone(client.phone || '');
    setPassword('');
    setNotes(client.notes || '');
    setFormMsg(null);
    setIsModalOpen(true);
  };

  const handleDeleteClient = async (client: UserProfile) => {
    const custVehicles = vehicles.filter(
      (v) =>
        v.customerId === client.id ||
        (v as any).owner_id === client.id ||
        (v as any).user_id === client.id
    );

    if (custVehicles.length > 0) {
      alert(`مشتری «${client.full_name}» دارای ${custVehicles.length} موتر/سوژه ثبت‌شده است و قابل حذف نیست. ابتدا موترها را منتقل یا حذف نمایید.`);
      return;
    }

    if (!confirm(`آیا از حذف مشتری «${client.full_name}» (${client.username}) از سامانه اطمینان دارید؟`)) {
      return;
    }

    setDeletingId(client.id);
    try {
      if (onDeleteCustomer) {
        const res = await onDeleteCustomer(client.id);
        if (res && res.success === false) {
          alert(res.error || 'خطا در حذف مشتری');
        } else {
          fetchClientProfiles();
        }
      } else {
        const res = await globalAuthService.deleteClientProfile(client.id);
        if (!res.success) {
          alert(res.error || 'خطا در حذف مشتری');
        } else {
          fetchClientProfiles();
        }
      }
    } catch (err: any) {
      alert(err.message || 'خطا در حذف مشتری');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingClientId) {
      if (!fullName.trim() || !phone.trim()) {
        setFormMsg({ type: 'error', text: 'لطفاً نام و شماره تماس مشتری را وارد کنید.' });
        return;
      }

      setIsSubmitting(true);
      setFormMsg(null);

      try {
        if (onUpdateCustomer) {
          const res = await onUpdateCustomer(editingClientId, {
            fullName: fullName.trim(),
            phone: phone.trim(),
            notes: notes.trim(),
          });
          if (res && res.success === false) {
            setFormMsg({ type: 'error', text: res.error || 'خطا در ویرایش اطلاعات مشتری' });
            setIsSubmitting(false);
            return;
          }
        } else {
          const res = await globalAuthService.updateClientProfile(editingClientId, {
            fullName: fullName.trim(),
            phone: phone.trim(),
            notes: notes.trim(),
          });
          if (!res.success) {
            setFormMsg({ type: 'error', text: res.error || 'خطا در ویرایش اطلاعات مشتری' });
            setIsSubmitting(false);
            return;
          }
        }

        setFormMsg({ type: 'success', text: 'مشخصات مشتری با موفقیت به‌روزرسانی شد.' });
        fetchClientProfiles();
        setTimeout(() => {
          setIsModalOpen(false);
          setIsSubmitting(false);
          setEditingClientId(null);
        }, 1200);
      } catch (err: any) {
        setFormMsg({ type: 'error', text: err.message || 'خطا در ویرایش مشتری' });
        setIsSubmitting(false);
      }
    } else {
      if (!fullName.trim() || !username.trim() || !phone.trim() || !password.trim()) {
        setFormMsg({ type: 'error', text: 'لطفاً تمام فیلدهای الزامی را پر کنید.' });
        return;
      }

      setIsSubmitting(true);
      setFormMsg(null);

      const { profile, error } = await globalAuthService.createClientAccount({
        username,
        fullName,
        phone,
        password,
        createdById: currentAdmin?.id || 'admin-system',
        notes,
      });

      setIsSubmitting(false);

      if (error || !profile) {
        setFormMsg({ type: 'error', text: error || 'خطا در ثبت مشتری' });
      } else {
        setFormMsg({ type: 'success', text: `مشتری ${fullName} با موفقیت ثبت شد و آماده تحویل است.` });
        fetchClientProfiles();
        setTimeout(() => {
          setIsModalOpen(false);
          setFullName('');
          setUsername('');
          setPhone('');
          setPassword('');
          setNotes('');
          setFormMsg(null);
        }, 1200);
      }
    }
  };

  const filteredClients = clientProfiles.filter(
    (c) =>
      c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-5">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">مدیریت مشتریان و مالکان وسایط نقلیه</h2>
          <p className="text-xs text-slate-500 mt-0.5">ثبت‌نام مستقیم مشتریان توسط اپراتورها، ویرایش و مدیریت مالکان</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجوی مشتری یا شماره..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>ثبت مشتری جدید</span>
          </button>
        </div>
      </div>

      {/* Client List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((c) => {
          const custVehicles = vehicles.filter(
            (v) =>
              v.customerId === c.id ||
              (v as any).owner_id === c.id ||
              (v as any).user_id === c.id
          );
          const hasVehicles = custVehicles.length > 0;

          return (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3.5 hover:shadow-md transition flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                      {c.full_name?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{c.full_name}</h3>
                      <p className="text-[11px] font-mono text-slate-500 dir-ltr text-right">@{c.username}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    حساب فعال
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-700 bg-slate-50/80 p-3 rounded-lg border border-slate-100">
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-slate-800">{c.phone}</span>
                    </div>
                  )}
                  {c.notes && (
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      یادداشت: {c.notes}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-slate-500">وسایط تحت مالکیت: </span>
                  <span className="font-bold text-blue-600 font-mono">{custVehicles.length} موتر</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Edit Button */}
                  <button
                    onClick={() => openEditModal(c)}
                    title="ویرایش اطلاعات مشتری"
                    className="p-1.5 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded border border-slate-200 hover:border-blue-300 transition shadow-2xs cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button (Disabled if client owns vehicles) */}
                  <button
                    onClick={() => handleDeleteClient(c)}
                    disabled={hasVehicles || deletingId === c.id}
                    title={
                      hasVehicles
                        ? `این مشتری مالک ${custVehicles.length} موتر است و امکان حذف آن وجود ندارد`
                        : 'حذف حساب مشتری'
                    }
                    className={`p-1.5 rounded border transition shadow-2xs ${
                      hasVehicles
                        ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                        : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200 hover:border-rose-300 cursor-pointer'
                    }`}
                  >
                    {deletingId === c.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredClients.length === 0 && !isLoading && (
          <div className="col-span-full bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
            هنوز مشتری جدیدی در پایگاه داده ثبت نشده است. روی دکمه «ثبت مشتری جدید» کلیک کنید.
          </div>
        )}
      </div>

      {/* Client Registration / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h3 className="text-base font-bold">
                  {editingClientId ? 'ویرایش مشخصات مشتری' : 'ثبت نام مشتری و تحویل پنل'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white p-1">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-right">
              {formMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  formMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {formMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                  <span>{formMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">نام کامل مشتری / شرکت *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: شرکت ترانسپورتی کابل هرات"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">نام کاربری (لاتین) *</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={username}
                    disabled={Boolean(editingClientId)}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="kabul_logistics"
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden ${
                      editingClientId ? 'bg-slate-100 cursor-not-allowed opacity-75' : ''
                    }`}
                    required
                  />
                  {editingClientId && (
                    <p className="text-[10px] text-slate-400 mt-1">نام کاربری ورود غیرقابل تغییر است.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">شماره تماس (ورود مشتری) *</label>
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

              {!editingClientId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">رمز عبور ورود مشتری *</label>
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
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">یادداشت / توضیحات قرارداد (اختیاری)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: قرارداد ۱ ساله برای ۳ موتر باربری"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium shadow-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition duration-150 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>در حال ذخیره...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingClientId ? 'ذخیره تغییرات مشتری' : 'تایید و ایجاد حساب مشتری'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
