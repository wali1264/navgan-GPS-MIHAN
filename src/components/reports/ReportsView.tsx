/**
 * Reports & Fleet Analytics View
 * Generates Daily Fleet Summary, Mileage, Overspeeding records, and exports data to CSV.
 */
import React, { useState, useEffect } from 'react';
import { Vehicle, VehicleCurrentState } from '../../shared/types/models';
import { FileSpreadsheet, Download, Calendar, Filter, TrendingUp, Gauge, Route, Clock } from 'lucide-react';

interface ReportsViewProps {
  vehicles: Vehicle[];
  currentStates: VehicleCurrentState[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ vehicles, currentStates }) => {
  const [reportType, setReportType] = useState<'daily' | 'speed' | 'mileage'>('daily');
  const [reportData, setReportData] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/reports/daily')
      .then((res) => res.json())
      .then((data) => setReportData(data))
      .catch((err) => console.warn(err));
  }, []);

  const handleExportCsv = () => {
    window.location.href = '/api/reports/export-csv';
  };

  return (
    <div className="space-y-5">
      {/* Header & Export Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">راپورها و گزارشات تحلیلی ناوگان</h2>
          <p className="text-xs text-slate-500 mt-0.5">گزارش کارکرد روزانه، کیلومتراژ، ساعات روشنی ماشین و تخلفات سرعت</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
            <button
              onClick={() => setReportType('daily')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                reportType === 'daily' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              راپور روزانه
            </button>
            <button
              onClick={() => setReportType('mileage')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                reportType === 'mileage' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              کارکرد کیلومتر
            </button>
            <button
              onClick={() => setReportType('speed')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                reportType === 'speed' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تخلفات سرعت
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی اکسل (CSV)</span>
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-bold border-b border-slate-200/80">
              <tr>
                <th className="p-4">نمبر پلیت</th>
                <th className="p-4">نام موتر</th>
                <th className="p-4">وضعیت فعلی</th>
                <th className="p-4">مسافت امروز (km)</th>
                <th className="p-4">حداکثر سرعت</th>
                <th className="p-4">ساعات کارکرد انجن</th>
                <th className="p-4">آخرین موقعیت ثبت شده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition">
                  <td className="p-4 font-bold text-blue-600 font-mono">{row.plateNumber}</td>
                  <td className="p-4 text-slate-900 font-medium">{row.vehicleName}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold">
                      {row.status}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-emerald-700 font-bold">{row.todayDistanceKm} km</td>
                  <td className="p-4 font-mono text-amber-700 font-bold">{row.maxSpeedKm} km/h</td>
                  <td className="p-4 font-mono text-slate-700">{row.engineHours} ساعت</td>
                  <td className="p-4 text-slate-500 truncate max-w-xs">{row.lastAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
