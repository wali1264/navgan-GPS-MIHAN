/**
 * Drivers Management View
 */
import React from 'react';
import { Driver, Vehicle } from '../../shared/types/models';
import { Users, Phone, Award, Car, CheckCircle } from 'lucide-react';

interface DriversManagerProps {
  drivers: Driver[];
  vehicles: Vehicle[];
}

export const DriversManager: React.FC<DriversManagerProps> = ({ drivers, vehicles }) => {
  return (
    <div className="space-y-5">
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">مدیریت درایوران و رانندگان ناوگان</h2>
        <p className="text-xs text-slate-500 mt-0.5">ثبت لایسنس ترافیک، شماره تماس و اتصال به موترهای ناوگان</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((d) => {
          const assignedVehicles = vehicles.filter((v) => v.driverId === d.id);

          return (
            <div key={d.id} className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {d.name.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{d.name}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">لایسنس: {d.licenseNumber}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {d.status}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{d.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-medium text-slate-700">
                    {assignedVehicles.length > 0
                      ? assignedVehicles.map((v) => v.plateNumber).join(', ')
                      : 'بدون موتر موظف'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
