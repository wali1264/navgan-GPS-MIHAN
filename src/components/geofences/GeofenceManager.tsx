/**
 * Geofencing Management View (Admin / Staff)
 * Manages spatial boundaries (Circle and Polygon), vehicle assignments, and entry/exit alert triggers.
 */
import React, { useState } from 'react';
import { Geofence, Vehicle } from '../../shared/types/models';
import { GeofenceType } from '../../shared/types/enums';
import { ShieldAlert, Plus, Trash2, Edit2, MapPin, Radio, Check, X, Filter } from 'lucide-react';

interface GeofenceManagerProps {
  geofences: Geofence[];
  vehicles: Vehicle[];
  onAddGeofence: (geofence: Partial<Geofence>, isEdit?: boolean, existingId?: string) => Promise<boolean> | void;
  onDeleteGeofence: (id: string) => Promise<boolean> | void;
}

export const GeofenceManager: React.FC<GeofenceManagerProps> = ({
  geofences,
  vehicles,
  onAddGeofence,
  onDeleteGeofence,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGeofenceId, setEditingGeofenceId] = useState<string | null>(null);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GeofenceType>(GeofenceType.CIRCLE);
  const [centerLat, setCenterLat] = useState(34.5368);
  const [centerLng, setCenterLng] = useState(69.1724);
  const [radiusMeters, setRadiusMeters] = useState(800);
  const [color, setColor] = useState('#2563eb');
  const [notifyOnEnter, setNotifyOnEnter] = useState(true);
  const [notifyOnExit, setNotifyOnExit] = useState(true);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [assignAllVehicles, setAssignAllVehicles] = useState(true);

  const handleOpenAdd = () => {
    setEditingGeofenceId(null);
    setName('');
    setDescription('');
    setType(GeofenceType.CIRCLE);
    setCenterLat(34.5368);
    setCenterLng(69.1724);
    setRadiusMeters(800);
    setColor('#2563eb');
    setNotifyOnEnter(true);
    setNotifyOnExit(true);
    setAssignAllVehicles(true);
    setSelectedVehicleIds([]);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (gf: Geofence) => {
    setEditingGeofenceId(gf.id);
    setName(gf.name);
    setDescription(gf.description || '');
    setType(gf.type || GeofenceType.CIRCLE);
    setCenterLat(gf.centerLatitude || 34.5368);
    setCenterLng(gf.centerLongitude || 69.1724);
    setRadiusMeters(gf.radiusMeters || 800);
    setColor(gf.color || '#2563eb');
    setNotifyOnEnter(gf.notifyOnEnter);
    setNotifyOnExit(gf.notifyOnExit);
    if (!gf.assignedVehicleIds || gf.assignedVehicleIds.length === 0) {
      setAssignAllVehicles(true);
      setSelectedVehicleIds([]);
    } else {
      setAssignAllVehicles(false);
      setSelectedVehicleIds(gf.assignedVehicleIds);
    }
    setIsAddModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const assigned = assignAllVehicles
      ? []
      : selectedVehicleIds.length > 0
      ? selectedVehicleIds
      : vehicles.map((v) => v.id);

    const payload: Partial<Geofence> = {
      name: name.trim(),
      description: description.trim(),
      type,
      centerLatitude: centerLat,
      centerLongitude: centerLng,
      radiusMeters,
      color,
      notifyOnEnter,
      notifyOnExit,
      assignedVehicleIds: assigned,
    };

    const isEdit = !!editingGeofenceId;
    await onAddGeofence(payload, isEdit, editingGeofenceId || undefined);

    setIsAddModalOpen(false);
    setEditingGeofenceId(null);
  };

  const filteredGeofences = geofences.filter((gf) => {
    if (!selectedVehicleFilter) return true;
    return (
      !gf.assignedVehicleIds ||
      gf.assignedVehicleIds.length === 0 ||
      gf.assignedVehicleIds.includes(selectedVehicleFilter)
    );
  });

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">مدیریت محدوده‌های جغرافیایی (Geofencing)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تعریف ساحات مجاز، گدام‌ها، پارکینگ‌ها و ساحات نظارتی با پایش لحظه‌ای و هشدار خروج/ورود
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Filter by Vehicle */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedVehicleFilter}
              onChange={(e) => setSelectedVehicleFilter(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">همه وسایط نقلیه</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} ({v.vehicleName})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-2 transition cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>ایجاد محدوده جغرافیایی جدید</span>
          </button>
        </div>
      </div>

      {/* Geofences List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGeofences.length === 0 ? (
          <div className="col-span-full py-16 bg-white border border-dashed border-slate-300 rounded-xl text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-800">هیچ محدوده جغرافیایی یافت نشد</p>
            <p className="text-[11px] text-slate-500">برای شروع، روی دکمه «ایجاد محدوده جغرافیایی جدید» کلیک کنید.</p>
          </div>
        ) : (
          filteredGeofences.map((gf) => {
            const hasAll = !gf.assignedVehicleIds || gf.assignedVehicleIds.length === 0;
            return (
              <div
                key={gf.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-blue-300 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: gf.color || '#2563eb' }} />
                      <h3 className="text-sm font-bold text-slate-900">{gf.name}</h3>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium font-mono">
                      {gf.type === GeofenceType.CIRCLE ? 'دایروی' : 'چندضلعی'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mb-3">{gf.description || 'بدون توضیحات اضافی'}</p>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1.5 text-slate-700">
                    {gf.type === GeofenceType.CIRCLE && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">شعاع محدوده:</span>
                          <strong className="text-blue-600 font-mono">{gf.radiusMeters || 800} متر</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">مرکز ساحه:</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {gf.centerLatitude?.toFixed(4)}, {gf.centerLongitude?.toFixed(4)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">وسایط تحت نظارت:</span>
                      <strong className="text-slate-900 font-mono">
                        {hasAll ? 'همه وسایط نقلیه' : `${gf.assignedVehicleIds.length} موتر مشخص`}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-2.5">
                    <span className={gf.notifyOnEnter ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                      {gf.notifyOnEnter ? '✓ هشدار ورود' : '✕ بدون هشدار ورود'}
                    </span>
                    <span className={gf.notifyOnExit ? 'text-amber-700 font-medium' : 'text-slate-400'}>
                      {gf.notifyOnExit ? '✓ هشدار خروج' : '✕ بدون هشدار خروج'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEdit(gf)}
                    className="p-1.5 px-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 transition border border-slate-200 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>ویرایش</span>
                  </button>
                  <button
                    onClick={() => onDeleteGeofence(gf.id)}
                    className="p-1.5 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 transition border border-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create or Edit */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                {editingGeofenceId ? 'ویرایش محدوده جغرافیایی' : 'ایجاد محدوده جغرافیایی جدید (Geofence)'}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-700 font-bold mb-1">نام محدوده (ساحه)</label>
                <input
                  type="text"
                  placeholder="مثال: گدام مرکزی کابل یا ساحه گمرک اسلام قلعه"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-bold mb-1">توضیحات اختیاری</label>
                <input
                  type="text"
                  placeholder="محدوده مجاز بارگیری، تخلیه یا تردد شبانه"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-700 font-bold mb-1">عرض جغرافیایی (Lat)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={centerLat}
                    onChange={(e) => setCenterLat(parseFloat(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-bold mb-1">طول جغرافیایی (Lng)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={centerLng}
                    onChange={(e) => setCenterLng(parseFloat(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label className="text-slate-700 font-bold">شعاع ساحه دایروی:</label>
                  <span className="font-mono font-bold text-blue-600">{radiusMeters} متر</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={10000}
                  step={50}
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Vehicle Assignment Selection */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs text-slate-700 font-bold mb-1.5">تخصیص به وسایط نقلیه:</label>
                <div className="flex items-center gap-3 text-xs mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800">
                    <input
                      type="radio"
                      checked={assignAllVehicles}
                      onChange={() => {
                        setAssignAllVehicles(true);
                        setSelectedVehicleIds([]);
                      }}
                      className="accent-blue-600"
                    />
                    <span>همه وسایط نقلیه موجود</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-800">
                    <input
                      type="radio"
                      checked={!assignAllVehicles}
                      onChange={() => setAssignAllVehicles(false)}
                      className="accent-blue-600"
                    />
                    <span>انتخاب موتر مشخص</span>
                  </label>
                </div>

                {!assignAllVehicles && (
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1.5 bg-slate-50">
                    {vehicles.map((v) => {
                      const isChecked = selectedVehicleIds.includes(v.id);
                      return (
                        <label
                          key={v.id}
                          className="flex items-center gap-2 text-xs p-1 hover:bg-white rounded cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedVehicleIds((prev) => [...prev, v.id]);
                              } else {
                                setSelectedVehicleIds((prev) => prev.filter((id) => id !== v.id));
                              }
                            }}
                            className="rounded accent-blue-600"
                          />
                          <span className="font-mono font-bold text-slate-800">{v.plateNumber}</span>
                          <span className="text-slate-500">({v.vehicleName})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-700 pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={notifyOnExit}
                    onChange={(e) => setNotifyOnExit(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <span>هشدار هنگام خروج (پیشنهادی)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={notifyOnEnter}
                    onChange={(e) => setNotifyOnEnter(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <span>هشدار هنگام ورود</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition"
                >
                  {editingGeofenceId ? 'ذخیره تغییرات' : 'ایجاد محدوده'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
