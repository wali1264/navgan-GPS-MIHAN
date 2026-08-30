/**
 * Geofencing Management View
 * Manages spatial boundaries (Circle and Polygon), vehicle assignments, and entry/exit alert triggers.
 */
import React, { useState } from 'react';
import { Geofence, Vehicle } from '../../shared/types/models';
import { GeofenceType } from '../../shared/types/enums';
import { ShieldAlert, Plus, Trash2, MapPin, Radio, Eye } from 'lucide-react';

interface GeofenceManagerProps {
  geofences: Geofence[];
  vehicles: Vehicle[];
  onAddGeofence: (geofence: Partial<Geofence>) => void;
  onDeleteGeofence: (id: string) => void;
}

export const GeofenceManager: React.FC<GeofenceManagerProps> = ({
  geofences,
  vehicles,
  onAddGeofence,
  onDeleteGeofence,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GeofenceType>(GeofenceType.CIRCLE);
  const [centerLat, setCenterLat] = useState(34.5368);
  const [centerLng, setCenterLng] = useState(69.1724);
  const [radiusMeters, setRadiusMeters] = useState(800);
  const [color, setColor] = useState('#06b6d4');
  const [notifyOnEnter, setNotifyOnEnter] = useState(true);
  const [notifyOnExit, setNotifyOnExit] = useState(true);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    onAddGeofence({
      name,
      description,
      type,
      centerLatitude: centerLat,
      centerLongitude: centerLng,
      radiusMeters,
      color,
      notifyOnEnter,
      notifyOnExit,
      assignedVehicleIds: vehicles.map((v) => v.id),
    });

    setIsAddModalOpen(false);
    setName('');
    setDescription('');
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">مدیریت محدوده‌های جغرافیایی (Geofencing)</h2>
          <p className="text-xs text-slate-500 mt-0.5">تعریف ساحات مجاز، گدام‌ها، پارکینگ‌ها و ساحات ممنوعه با هشدار ورود/خروج</p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md shadow-xs flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>ایجاد محدوده جغرافیایی جدید</span>
        </button>
      </div>

      {/* Geofences List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {geofences.map((gf) => {
          return (
            <div
              key={gf.id}
              className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: gf.color }} />
                    <h3 className="text-sm font-bold text-slate-900">{gf.name}</h3>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                    {gf.type === GeofenceType.CIRCLE ? 'دایروی' : 'چندضلعی'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 mb-3">{gf.description || 'بدون توضیحات اضافی'}</p>

                <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100 text-xs space-y-1.5 text-slate-700">
                  {gf.type === GeofenceType.CIRCLE && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">شعاع محدوده:</span>
                        <strong className="text-blue-600 font-mono">{gf.radiusMeters} متر</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">مرکز ساحه:</span>
                        <span className="font-mono text-[11px] text-slate-500">{gf.centerLatitude?.toFixed(4)}, {gf.centerLongitude?.toFixed(4)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500">وسایط تحت نظارت:</span>
                    <strong className="text-slate-900">{gf.assignedVehicleIds.length} موتر</strong>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 mt-2.5">
                  <span className={gf.notifyOnEnter ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                    ✓ هشدار ورود
                  </span>
                  <span className={gf.notifyOnExit ? 'text-amber-700 font-medium' : 'text-slate-400'}>
                    ✓ هشدار خروج
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end pt-3 mt-3 border-t border-slate-100">
                <button
                  onClick={() => onDeleteGeofence(gf.id)}
                  className="p-1.5 px-2.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium flex items-center gap-1 transition border border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف محدوده</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4 text-right z-[100000]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">ایجاد محدوده جغرافیایی (Geofence)</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">نام محدوده (ساحه)</label>
                <input
                  type="text"
                  placeholder="مثال: گدام مرکزی کابل یا ساحه گمرک"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">توضیحات اختیاری</label>
                <input
                  type="text"
                  placeholder="محدوده مجاز بارگیری و تخلیه"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">عرض جغرافیایی (Latitude)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={centerLat}
                    onChange={(e) => setCenterLat(parseFloat(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">طول جغرافیایی (Longitude)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={centerLng}
                    onChange={(e) => setCenterLng(parseFloat(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">شعاع ساحه دایروی (متر)</label>
                <input
                  type="number"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10))}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-700 pt-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnEnter}
                    onChange={(e) => setNotifyOnEnter(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <span>هشدار هنگام ورود</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnExit}
                    onChange={(e) => setNotifyOnExit(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <span>هشدار هنگام خروج</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium shadow-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-xs"
                >
                  ذخیره محدوده
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
