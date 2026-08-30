/**
 * Fleet Maintenance & Service Log View
 */
import React, { useState, useEffect } from 'react';
import { MaintenanceRecord, Vehicle } from '../../shared/types/models';
import { Wrench, Plus, CheckCircle, Clock, AlertCircle, DollarSign, Car } from 'lucide-react';

interface MaintenanceViewProps {
  vehicles: Vehicle[];
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({ vehicles }) => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);

  useEffect(() => {
    fetch('/api/maintenance')
      .then((res) => res.json())
      .then((data) => setRecords(data))
      .catch((err) => console.warn(err));
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">مدیریت مراقبت، ترمیمات و سرویس ناوگان</h2>
          <p className="text-xs text-slate-500 mt-0.5">ثبت تعویض مبلایل، فلتر، تایرها و مصرف سرویس به افغانی (AFN)</p>
        </div>
      </div>

      {/* Maintenance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {records.map((rec) => {
          const vehicle = vehicles.find((v) => v.id === rec.vehicleId);

          return (
            <div
              key={rec.id}
              className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs space-y-3.5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{rec.serviceType}</h3>
                    <p className="text-[11px] text-blue-600 font-mono font-bold">{vehicle?.plateNumber || 'موتر'}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                  تکمیل شده
                </span>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                {rec.description}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                <div>کیلومتر موتر: <strong className="text-slate-800 font-mono">{rec.odometerAtService.toLocaleString()} km</strong></div>
                <div>هزینه سرویس: <strong className="text-emerald-700 font-mono">{rec.costAfn.toLocaleString()} AFN</strong></div>
                <div>انجام شده توسط: <span className="text-slate-700 font-medium">{rec.performedBy}</span></div>
                <div>تاریخ: <span className="text-slate-700 font-mono">{new Date(rec.serviceDate).toLocaleDateString('fa-AF')}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
