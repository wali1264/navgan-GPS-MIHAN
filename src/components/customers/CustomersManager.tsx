/**
 * Customers & Organizations Manager
 */
import React from 'react';
import { Customer, Vehicle } from '../../shared/types/models';
import { Building2, Phone, Mail, MapPin, Car } from 'lucide-react';

interface CustomersManagerProps {
  customers: Customer[];
  vehicles: Vehicle[];
}

export const CustomersManager: React.FC<CustomersManagerProps> = ({ customers, vehicles }) => {
  return (
    <div className="space-y-5">
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">شرکت‌ها و سازمان‌های مشتری در افغانستان</h2>
        <p className="text-xs text-slate-500 mt-0.5">سیستم چندمستأجری (Multi-Tenant) با تفکیک کامل داده‌های هر مشتری</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((c) => {
          const custVehicles = vehicles.filter((v) => v.customerId === c.id);

          return (
            <div key={c.id} className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{c.name}</h3>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 inline-block mt-0.5">
                    حساب فعال
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-700 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.city} - {c.address}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                <span className="text-slate-500">تعداد موترهای تحت پوشش:</span>
                <span className="font-bold text-blue-600 font-mono">{custVehicles.length} موتر</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
