/**
 * GPS Hardware & Device Manager
 * Manages physical tracker hardware, IMEI records, protocol assignments, SIM cards, and connection health.
 */
import React, { useState } from 'react';
import { Device, Vehicle } from '../../shared/types/models';
import { ProtocolType } from '../../shared/types/enums';
import { Cpu, Plus, Search, CheckCircle, AlertCircle, Signal, Radio, Terminal, Edit2, Trash2, Power, PowerOff, Smartphone, ShieldAlert } from 'lucide-react';

interface DevicesManagerProps {
  devices: Device[];
  vehicles: Vehicle[];
  onAddDevice: (device: Partial<Device>) => Promise<{ success: boolean; error?: string } | any> | void;
  onUpdateDevice?: (id: string, updates: any) => Promise<{ success: boolean; error?: string } | any> | void;
  onDeleteDevice?: (id: string) => Promise<{ success: boolean; error?: string } | any> | void;
}

export const DevicesManager: React.FC<DevicesManagerProps> = ({
  devices,
  vehicles,
  onAddDevice,
  onUpdateDevice,
  onDeleteDevice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);

  const [imei, setImei] = useState('');
  const [protocol, setProtocol] = useState<ProtocolType>(ProtocolType.GT06);
  const [model, setModel] = useState('Concox GT06N');
  const [simNumber, setSimNumber] = useState('');
  const [simOperator, setSimOperator] = useState('Roshan');
  const [deviceType, setDeviceType] = useState<'vehicle_tracker' | 'smartphone'>('vehicle_tracker');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [antiTheftPin, setAntiTheftPin] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredDevices = devices.filter(
    (d) =>
      d.imei.includes(searchTerm) ||
      d.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.simNumber && d.simNumber.includes(searchTerm))
  );

  const generateSmartphoneId = () => {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    setImei(`AFG-${randomDigits}`);
  };

  const openAddModal = (initialType: 'vehicle_tracker' | 'smartphone' = 'vehicle_tracker') => {
    setEditingDeviceId(null);
    setDeviceType(initialType);
    if (initialType === 'smartphone') {
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      setImei(`AFG-${randomDigits}`);
      setProtocol(ProtocolType.SMARTPHONE_AGENT);
      setModel('گوشی هوشمند اندروید');
    } else {
      setImei('');
      setProtocol(ProtocolType.GT06);
      setModel('Concox GT06N');
    }
    setSimNumber('');
    setSimOperator('Roshan');
    setEmergencyContactPhone('');
    setAntiTheftPin('1234');
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const openEditModal = (d: Device) => {
    setEditingDeviceId(d.id);
    setImei(d.imei);
    setProtocol(d.protocol);
    setModel(d.model);
    setSimNumber(d.simNumber || '');
    setSimOperator(d.simOperator || 'Roshan');
    setDeviceType(d.deviceType || (d.protocol === ProtocolType.SMARTPHONE_AGENT ? 'smartphone' : 'vehicle_tracker'));
    setEmergencyContactPhone(d.emergencyContactPhone || '');
    setAntiTheftPin(d.antiTheftPin || '1234');
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (d: Device) => {
    if (!onUpdateDevice) return;
    const newStatus = d.status === 'ACTIVE' ? 'offline' : 'online';
    try {
      const res = await onUpdateDevice(d.id, { status: newStatus });
      if (res && res.success === false) {
        alert(res.error || 'خطا در تغییر وضعیت دستگاه');
      }
    } catch (err: any) {
      alert(err.message || 'خطا در تغییر وضعیت دستگاه');
    }
  };

  const handleDelete = async (d: Device) => {
    const assignedVehicle = vehicles.find((v) => v.deviceId === d.id || v.id === d.assignedVehicleId);
    if (assignedVehicle) {
      alert(`این دستگاه به سوژه (${assignedVehicle.plateNumber || assignedVehicle.vehicleName}) متصل است و قابل حذف نیست. ابتدا اتصال را قطع کنید.`);
      return;
    }

    if (!confirm(`آیا از حذف دستگاه با کد IMEI: ${d.imei} اطمینان دارید؟`)) {
      return;
    }

    setDeletingId(d.id);
    try {
      if (onDeleteDevice) {
        const res = await onDeleteDevice(d.id);
        if (res && res.success === false) {
          alert(res.error || 'خطا در حذف دستگاه');
        }
      }
    } catch (err: any) {
      alert(err.message || 'خطا در حذف دستگاه');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imei.trim()) {
      setFormError('لطفاً کد ۱۵ رقمی IMEI دستگاه را وارد نمایید');
      return;
    }

    setFormError('');
    setFormSuccess('');
    setIsSubmitting(true);

    try {
      if (editingDeviceId) {
        if (onUpdateDevice) {
          const res = await onUpdateDevice(editingDeviceId, {
            protocol,
            model_name: model,
            sim_number: simNumber.trim(),
            sim_operator: simOperator,
            device_type: deviceType,
            emergency_contact_phone: emergencyContactPhone.trim(),
            anti_theft_pin: antiTheftPin.trim(),
          });

          if (res && res.success === false) {
            setFormError(res.error || 'خطا در ویرایش دستگاه');
            setIsSubmitting(false);
            return;
          }
        }
        setFormSuccess('مشخصات دستگاه با موفقیت ویرایش گردید.');
      } else {
        const res = await onAddDevice({
          imei: imei.trim(),
          protocol,
          model,
          simNumber: simNumber.trim(),
          simOperator,
          deviceType,
          emergencyContactPhone: emergencyContactPhone.trim(),
          antiTheftPin: antiTheftPin.trim(),
          status: 'ACTIVE',
        });

        if (res && res.success === false) {
          setFormError(res.error || 'خطا در ثبت دستگاه');
          setIsSubmitting(false);
          return;
        }
        setFormSuccess(deviceType === 'smartphone' ? 'گوشی هوشمند با موفقیت در سامانه ثبت گردید.' : 'دستگاه ردیاب با موفقیت در سامانه ثبت گردید.');
      }

      setTimeout(() => {
        setIsModalOpen(false);
        setImei('');
        setSimNumber('');
        setFormSuccess('');
        setIsSubmitting(false);
        setEditingDeviceId(null);
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت یا ویرایش دستگاه');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="جستجو بر اساس کد IMEI، مدل یا سیمکارت..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-md pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => openAddModal('smartphone')}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-md shadow-xs flex items-center justify-center gap-1.5 transition"
          >
            <Smartphone className="w-4 h-4" />
            <span>ثبت گوشی همراه جدید</span>
          </button>
          <button
            onClick={() => openAddModal('vehicle_tracker')}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md shadow-xs flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن ردیاب خودرو (GPS)</span>
          </button>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 text-[11px] font-bold">
              <tr>
                <th className="p-4">کد سخت‌افزار IMEI</th>
                <th className="p-4">پروتکل ارتباطی</th>
                <th className="p-4">مدل دستگاه</th>
                <th className="p-4">سیمکارت و اپراتور</th>
                <th className="p-4">سوژه متصل</th>
                <th className="p-4">تعداد پکت‌ها</th>
                <th className="p-4">وضعیت دستگاه</th>
                <th className="p-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDevices.map((d) => {
                const assignedVehicle = vehicles.find((v) => v.deviceId === d.id || v.id === d.assignedVehicleId);
                const isActive = d.status === 'ACTIVE';
                const isSmartphone = d.deviceType === 'smartphone' || d.protocol === ProtocolType.SMARTPHONE_AGENT;

                return (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 font-mono font-bold">
                      <div className="flex items-center gap-1.5">
                        {isSmartphone ? (
                          <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                        <span className={isSmartphone ? 'text-emerald-700' : 'text-blue-600'}>{d.imei}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {isSmartphone ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium text-[11px] inline-flex items-center gap-1">
                          <span>موبایل هوشمند</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]">
                          {d.protocol}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-900 font-medium">{d.model}</td>
                    <td className="p-4">
                      <div className="text-slate-800 font-mono">{d.simNumber || 'بدون شماره'}</div>
                      <div className="text-[11px] text-slate-400">{d.simOperator || 'افغانستان'}</div>
                    </td>
                    <td className="p-4">
                      {assignedVehicle ? (
                        <span className="text-emerald-700 font-medium">{assignedVehicle.plateNumber} ({assignedVehicle.vehicleName})</span>
                      ) : (
                        <span className="text-slate-400 italic">آزاد (بدون تخصیص)</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-800">{d.packetCount.toLocaleString()} پکت</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {isActive ? 'فعال (Active)' : 'غیرفعال (Disabled)'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Toggle Active / Inactive */}
                        <button
                          onClick={() => handleToggleStatus(d)}
                          title={isActive ? 'خاموش / غیرفعال‌سازی دستگاه' : 'روشن / فعال‌سازی دستگاه'}
                          className={`p-1.5 rounded border transition shadow-2xs ${
                            isActive
                              ? 'bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border-slate-200 hover:border-rose-300'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 hover:border-emerald-400'
                          }`}
                        >
                          {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => openEditModal(d)}
                          title="ویرایش مشخصات دستگاه"
                          className="p-1.5 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded border border-slate-200 hover:border-blue-300 transition shadow-2xs"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete (Disabled if assigned to vehicle) */}
                        <button
                          onClick={() => handleDelete(d)}
                          disabled={Boolean(assignedVehicle) || deletingId === d.id}
                          title={
                            assignedVehicle
                              ? `این دستگاه به سوژه (${assignedVehicle.plateNumber}) متصل است و امکان حذف ندارد`
                              : 'حذف دستگاه از سامانه'
                          }
                          className={`p-1.5 rounded border transition shadow-2xs ${
                            assignedVehicle
                              ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                              : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200 hover:border-rose-300 cursor-pointer'
                          }`}
                        >
                          {deletingId === d.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Device Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4 z-[100000]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingDeviceId ? 'ویرایش مشخصات دستگاه GPS' : 'افزودن دستگاه سخت‌افزاری GPS'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <span className="font-bold">خطا:</span>
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
                <span className="font-bold">موفقیت:</span>
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-right">
              {/* Type Switcher */}
              {!editingDeviceId && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setDeviceType('vehicle_tracker');
                      setProtocol(ProtocolType.GT06);
                      setModel('Concox GT06N');
                      setImei('');
                    }}
                    className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                      deviceType === 'vehicle_tracker' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>ردیاب سخت‌افزاری موتر</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeviceType('smartphone');
                      setProtocol(ProtocolType.SMARTPHONE_AGENT);
                      setModel('گوشی هوشمند اندروید');
                      generateSmartphoneId();
                    }}
                    className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                      deviceType === 'smartphone' ? 'bg-white text-emerald-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>گوشی همراه (موبایل)</span>
                  </button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-700 font-medium">
                    {deviceType === 'smartphone' ? 'شناسه ردیابی گوشی (IMEI / کد دستگاه)' : 'کد بین‌المللی IMEI (15 رقمی)'}
                  </label>
                  {deviceType === 'smartphone' && !editingDeviceId && (
                    <button
                      type="button"
                      onClick={generateSmartphoneId}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      تولید کد جدید
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={deviceType === 'smartphone' ? 'مثال: AFG-892104' : 'مثال: 868204051189209'}
                  value={imei}
                  disabled={Boolean(editingDeviceId)}
                  onChange={(e) => setImei(e.target.value)}
                  className={`w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 ${
                    editingDeviceId ? 'bg-slate-100 cursor-not-allowed opacity-75' : ''
                  }`}
                  required
                />
                {editingDeviceId && (
                  <p className="text-[11px] text-slate-400 mt-1">شناسه دستگاه به عنوان کلید یکتا غیرقابل تغییر است.</p>
                )}
              </div>

              {deviceType === 'vehicle_tracker' ? (
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">پروتکل استاندارد دیکودر</label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as ProtocolType)}
                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value={ProtocolType.GT06}>GT06 / Concox (بسته‌های باینری 0x78 0x78)</option>
                    <option value={ProtocolType.TELTONIKA}>Teltonika (بسته‌های باینری Codec 8 / FMC920 / FMB920)</option>
                    <option value={ProtocolType.TK103}>TK103 (بسته‌های متنی پرانتزی)</option>
                    <option value={ProtocolType.GPS103}>GPS103 / Coban</option>
                    <option value={ProtocolType.EELINK}>Eelink (بسته‌های 0x67 0x67)</option>
                    <option value={ProtocolType.CUSTOM_JSON}>Custom JSON / Telemetry IoT</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">شماره تماس اضطراری (دریافت پیامک سرقت و تعویض سیمکارت)</label>
                  <input
                    type="text"
                    placeholder="مثال: 0799112233"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">در صورت سرقت و تعویض سیمکارت، لوکیشن و شماره سارق به این خط ارسال می‌شود.</p>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">
                  {deviceType === 'smartphone' ? 'مدل و نام گوشی' : 'مدل تجارتی ردیاب'}
                </label>
                <input
                  type="text"
                  placeholder={deviceType === 'smartphone' ? 'مثال: سامسونگ گلکسی A14، شیائومی نوت 12' : 'مثال: Teltonika FMC920, Concox GT06N'}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">
                    {deviceType === 'smartphone' ? 'شماره سیمکارت فعلی گوشی' : 'شماره سیمکارت ردیاب'}
                  </label>
                  <input
                    type="text"
                    placeholder="+93700112233"
                    value={simNumber}
                    onChange={(e) => setSimNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">اپراتور مخابراتی</label>
                  <select
                    value={simOperator}
                    onChange={(e) => setSimOperator(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Roshan">روشن (Roshan)</option>
                    <option value="Afghan Wireless">افغان بی‌سیم (AWCC)</option>
                    <option value="Etisalat">اتصالات (Etisalat)</option>
                    <option value="MTN">ام‌تی‌ان (MTN)</option>
                    <option value="Salaam">سلام (Salaam)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium shadow-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white text-xs font-medium shadow-xs flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>در حال ثبت...</span>
                    </>
                  ) : (
                    <span>{editingDeviceId ? 'ذخیره تغییرات دستگاه' : 'ثبت دستگاه ردیاب'}</span>
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
