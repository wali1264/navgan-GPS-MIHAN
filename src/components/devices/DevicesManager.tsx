/**
 * GPS Hardware & Device Manager
 * Manages physical tracker hardware, IMEI records, protocol assignments, SIM cards, and connection health.
 */
import React, { useState } from 'react';
import { Device, Vehicle } from '../../shared/types/models';
import { ProtocolType } from '../../shared/types/enums';
import { Cpu, Plus, Search, CheckCircle, AlertCircle, Signal, Radio, Terminal } from 'lucide-react';

interface DevicesManagerProps {
  devices: Device[];
  vehicles: Vehicle[];
  onAddDevice: (device: Partial<Device>) => void;
}

export const DevicesManager: React.FC<DevicesManagerProps> = ({ devices, vehicles, onAddDevice }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [imei, setImei] = useState('');
  const [protocol, setProtocol] = useState<ProtocolType>(ProtocolType.GT06);
  const [model, setModel] = useState('Concox GT06N');
  const [simNumber, setSimNumber] = useState('');
  const [simOperator, setSimOperator] = useState('Roshan');

  const filteredDevices = devices.filter(
    (d) =>
      d.imei.includes(searchTerm) ||
      d.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.simNumber && d.simNumber.includes(searchTerm))
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imei) return;

    onAddDevice({
      imei,
      protocol,
      model,
      simNumber,
      simOperator,
      status: 'ACTIVE',
    });

    setIsAddModalOpen(false);
    setImei('');
    setSimNumber('');
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

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md shadow-xs flex items-center justify-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن دستگاه ردیاب GPS جدید</span>
        </button>
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
                <th className="p-4">موتر متصل</th>
                <th className="p-4">تعداد پکت‌ها</th>
                <th className="p-4">وضعیت اتصال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDevices.map((d) => {
                const assignedVehicle = vehicles.find((v) => v.deviceId === d.id || v.id === d.assignedVehicleId);

                return (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 font-mono text-blue-600 font-bold">{d.imei}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]">
                        {d.protocol}
                      </span>
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
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3" />
                        فعال (Active)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Device Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">افزودن دستگاه سخت‌افزاری GPS</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-right">
              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">کد بین‌المللی IMEI (15 رقمی)</label>
                <input
                  type="text"
                  placeholder="مثال: 868204051189209"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">پروتکل استاندارد دیکودر</label>
                <select
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value as ProtocolType)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value={ProtocolType.GT06}>GT06 / Concox (بسته‌های باینری 0x78 0x78)</option>
                  <option value={ProtocolType.TK103}>TK103 (بسته‌های متنی پرانتزی)</option>
                  <option value={ProtocolType.GPS103}>GPS103 / Coban</option>
                  <option value={ProtocolType.EELINK}>Eelink (بسته‌های 0x67 0x67)</option>
                  <option value={ProtocolType.CUSTOM_JSON}>Custom JSON / Telemetry IoT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-700 font-medium mb-1">مدل تجارتی ردیاب</label>
                <input
                  type="text"
                  placeholder="مثال: Concox GT06N, Coban TK103B, Eelink TK116"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-700 font-medium mb-1">شماره سیمکارت داخل دستگاه</label>
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
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium shadow-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-xs"
                >
                  ثبت دستگاه ردیاب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
