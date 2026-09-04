/**
 * Vehicles Management View
 * Features vehicle list, telemetry inspection, device assignment, and vehicle creation.
 */
import React, { useState } from 'react';
import { Vehicle, VehicleCurrentState, Device, Driver } from '../../shared/types/models';
import { VehicleType, VehicleStatus } from '../../shared/types/enums';
import { Car, Plus, Search, Filter, Battery, Signal, Key, MapPin, Gauge, Shield, Edit2, Trash2 } from 'lucide-react';

interface VehiclesManagerProps {
  vehicles: Vehicle[];
  currentStates: VehicleCurrentState[];
  devices: Device[];
  drivers: Driver[];
  customers?: any[];
  onAddVehicle: (vehicle: Partial<Vehicle>) => Promise<{ success: boolean; error?: string } | any> | void;
  onUpdateVehicle?: (id: string, vehicle: Partial<Vehicle>) => Promise<{ success: boolean; error?: string } | any> | void;
  onDeleteVehicle?: (id: string) => Promise<{ success: boolean; error?: string } | any> | void;
  onSelectVehicle: (vehicleId: string) => void;
}

export const VehiclesManager: React.FC<VehiclesManagerProps> = ({
  vehicles,
  currentStates,
  devices,
  drivers,
  customers = [],
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  onSelectVehicle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  // Form State
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.CAR);
  const [brand, setBrand] = useState('Toyota');
  const [model, setModel] = useState('Corolla');
  const [speedLimit, setSpeedLimit] = useState(100);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const openAddModal = () => {
    setEditingVehicleId(null);
    setPlateNumber('');
    setVehicleName('');
    setSelectedDeviceId('');
    setSelectedCustomerId('');
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id);
    setPlateNumber(vehicle.plateNumber || '');
    setVehicleName(vehicle.vehicleName || '');
    setSelectedDeviceId(vehicle.deviceId || '');
    setSelectedCustomerId(vehicle.customerId || '');
    setFormError('');
    setFormSuccess('');
    setIsModalOpen(true);
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (vehicle.deviceId) {
      alert('این سوژه دارای دستگاه GPS متصل است و قابل حذف نیست. ابتدا از بخش ویرایش، دستگاه را جدا (بدون ردیاب) کنید.');
      return;
    }

    if (!confirm(`آیا از حذف سوژه «${vehicle.plateNumber} (${vehicle.vehicleName})» اطمینان دارید؟`)) {
      return;
    }

    setDeletingId(vehicle.id);
    setDeleteError('');
    try {
      if (onDeleteVehicle) {
        const res = await onDeleteVehicle(vehicle.id);
        if (res && res.success === false) {
          alert(res.error || 'خطا در حذف سوژه');
        }
      }
    } catch (err: any) {
      alert(err.message || 'خطا در حذف سوژه');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.vehicleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || v.vehicleType === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber.trim() || !vehicleName.trim()) {
      setFormError('لطفاً شناسه/نمبر پلیت و عنوان توصیفی را وارد نمایید');
      return;
    }

    setFormError('');
    setFormSuccess('');
    setIsSubmitting(true);

    try {
      if (editingVehicleId) {
        if (onUpdateVehicle) {
          const res = await onUpdateVehicle(editingVehicleId, {
            plateNumber: plateNumber.trim(),
            vehicleName: vehicleName.trim(),
            deviceId: selectedDeviceId.trim() || undefined,
            customerId: selectedCustomerId.trim() || undefined,
          });

          if (res && res.success === false) {
            setFormError(res.error || 'خطا در ویرایش سوژه');
            setIsSubmitting(false);
            return;
          }
        }
        setFormSuccess('سوژه با موفقیت ویرایش گردید.');
      } else {
        const res = await onAddVehicle({
          plateNumber: plateNumber.trim(),
          vehicleName: vehicleName.trim(),
          vehicleType,
          brand,
          model,
          year: 2023,
          color: 'سفید',
          speedLimit,
          odometer: 0,
          deviceId: selectedDeviceId.trim() || undefined,
          customerId: selectedCustomerId.trim() || undefined,
        });

        if (res && res.success === false) {
          setFormError(res.error || 'خطا در ثبت سوژه');
          setIsSubmitting(false);
          return;
        }
        setFormSuccess('سوژه با موفقیت در سامانه ثبت گردید.');
      }

      setTimeout(() => {
        setIsModalOpen(false);
        setPlateNumber('');
        setVehicleName('');
        setSelectedCustomerId('');
        setSelectedDeviceId('');
        setFormSuccess('');
        setIsSubmitting(false);
        setEditingVehicleId(null);
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'خطا در پردازش اطلاعات');
      setIsSubmitting(false);
    }
  };

  const getTypeNameInPersian = (type: VehicleType) => {
    switch (type) {
      case VehicleType.CAR: return 'موتر سواری';
      case VehicleType.TRUCK: return 'لاری / باربری';
      case VehicleType.PICKUP: return 'پیک‌اپ';
      case VehicleType.VAN: return 'ون / هایس';
      case VehicleType.BUS: return 'ملی‌بس شهری';
      case VehicleType.TAXI: return 'تکسی';
      case VehicleType.MOTORCYCLE: return 'موترسایکل';
      default: return 'سایر وسایط';
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجو بر اساس پلاک، نام موتر یا مدل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-md pr-9 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">همه انواع موتر</option>
            <option value={VehicleType.CAR}>موتر سواری</option>
            <option value={VehicleType.TRUCK}>لاری باربری</option>
            <option value={VehicleType.PICKUP}>پیک‌اپ</option>
            <option value={VehicleType.VAN}>هایس / ون</option>
          </select>
        </div>

        <button
          onClick={openAddModal}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md shadow-xs flex items-center justify-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت سوژه جدید</span>
        </button>
      </div>

      {/* Vehicles Grid / Cards */}
      {filteredVehicles.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-xl p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <Car className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">هنوز هیچ موتری در سامانه ثبت نشده است</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            سیستم آماده پذیرش وسایط نقلیه واقعی است. با کلیک بر روی دکمه زیر، اولین موتر ناوگان را ثبت نمایید.
          </p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md shadow-xs inline-flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت اولین موتر</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVehicles.map((v) => {
            const state = currentStates.find((s) => s.vehicleId === v.id);
            const device = devices.find((d) => d.id === v.deviceId);
            const driver = drivers.find((d) => d.id === v.driverId);

            const statusBadge =
              state?.onlineStatus === VehicleStatus.MOVING
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : state?.onlineStatus === VehicleStatus.IDLE
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : state?.onlineStatus === VehicleStatus.STOPPED
                ? 'bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-rose-50 text-rose-700 border-rose-200';

            return (
              <div
                key={v.id}
                className="bg-white border border-slate-100 hover:border-slate-300 rounded-xl p-5 transition-shadow shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{v.plateNumber}</h3>
                        <p className="text-xs text-slate-500">{v.vehicleName}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded font-bold border ${statusBadge}`}>
                      {state?.onlineStatus === VehicleStatus.MOVING
                        ? 'حرکت'
                        : state?.onlineStatus === VehicleStatus.IDLE
                        ? 'درجا'
                        : state?.onlineStatus === VehicleStatus.STOPPED
                        ? 'پارک'
                        : 'آفلاین'}
                    </span>
                  </div>

                  {/* Telemetry Details */}
                  {(() => {
                    const isOffline = !state || state.onlineStatus === VehicleStatus.OFFLINE;
                    const batteryDisplay =
                      isOffline
                        ? 'قطع ارتباط'
                        : state?.batteryVoltage !== undefined
                        ? `${state.batteryVoltage}V`
                        : 'بدون سنسور';
                    const signalDisplay = isOffline ? 'قطع' : `${state?.gsmSignal || 0}%`;

                    return (
                      <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-3 rounded-lg border border-slate-100 text-xs mb-3">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Gauge className="w-3.5 h-3.5 text-blue-600" />
                          <span>سرعت: <strong className="text-slate-900 font-mono">{state?.speed || 0}</strong> km/h</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Signal className="w-3.5 h-3.5 text-indigo-600" />
                          <span>سیگنال: <strong className="text-slate-900 font-mono">{signalDisplay}</strong></span>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 text-slate-600">
                          <Battery className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ولتاژ بطری: <strong className="text-slate-900 font-mono">{batteryDisplay}</strong></span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Device & Driver Info */}
                  <div className="space-y-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span>نوع موتر:</span>
                      <span className="text-slate-800 font-medium">{getTypeNameInPersian(v.vehicleType)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>ردیاب GPS / IMEI:</span>
                      <span className="font-mono text-blue-600 font-medium">{device ? device.imei : 'تعیین نشده'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>درایور موظف:</span>
                      <span className="text-slate-800">{driver ? driver.name : 'درایور آزاد'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>موقعیت جاری:</span>
                      <span className="text-slate-700 truncate max-w-[170px]">{state?.address || 'موقعیت دریافت نشده'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => onSelectVehicle(v.id)}
                    className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-medium rounded-md border border-slate-200 transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>ردیابی زنده در نقشه</span>
                  </button>

                  {/* Edit Button */}
                  <button
                    onClick={() => openEditModal(v)}
                    title="ویرایش مشخصات سوژه"
                    className="p-2 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-md border border-slate-200 hover:border-blue-300 transition shadow-xs flex items-center justify-center"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button (Disabled if GPS attached) */}
                  <button
                    onClick={() => handleDelete(v)}
                    disabled={Boolean(v.deviceId) || deletingId === v.id}
                    title={
                      v.deviceId
                        ? 'این سوژه دارای ردیاب متصل است. ابتدا اتصال ردیاب را از ویرایش قطع کنید.'
                        : 'حذف سوژه از سامانه'
                    }
                    className={`p-2 rounded-md border transition shadow-xs flex items-center justify-center ${
                      v.deviceId
                        ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                        : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200 hover:border-rose-300 cursor-pointer'
                    }`}
                  >
                    {deletingId === v.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Subject Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-xl w-full max-w-lg p-6 shadow-2xl space-y-4 z-[100000]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingVehicleId ? 'ویرایش مشخصات سوژه' : 'ثبت سوژه جدید در سامانه ردیابی'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
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
              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">شناسه یا نمبر پلیت (ضروری)</label>
                <input
                  type="text"
                  placeholder="مثال: کابل 4 - 84920 یا ID-102"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">نام یا عنوان توصیفی</label>
                <input
                  type="text"
                  placeholder="مثال: تویوتا کرولا، احمد رحیمی، اسب مسابقه، کانتینر بار"
                  value={vehicleName}
                  onChange={(e) => setVehicleName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-700 font-medium">تخصیص دستگاه GPS ردیاب</label>
                  {editingVehicleId && (
                    <span className="text-[11px] text-amber-600">
                      (جهت امکان حذف سوژه، روی «بدون ردیاب» تنظیم کنید)
                    </span>
                  )}
                </div>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">بدون ردیاب (تخصیص بعداً)</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.model} - IMEI: {d.imei} ({d.protocol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">مالک / مشتری مربوطه</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="">ناوگان عمومی شرکت (بدون مشتری خاص)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.full_name} ({c.phone || c.username})
                    </option>
                  ))}
                </select>
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
                    <span>{editingVehicleId ? 'ذخیره تغییرات سوژه' : 'ذخیره و ثبت در سیستم'}</span>
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
