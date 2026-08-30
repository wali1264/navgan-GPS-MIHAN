/**
 * Device Commands & Remote Telecontrol
 * Allows operators to dispatch commands: Engine Cut-off, Restore Engine, Location Request, Interval Config, Reboot.
 */
import React, { useState } from 'react';
import { Vehicle, Device, DeviceCommand } from '../../shared/types/models';
import { CommandType } from '../../shared/types/enums';
import { Terminal, Send, PowerOff, RotateCcw, MapPin, Clock, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

interface CommandsViewProps {
  vehicles: Vehicle[];
  devices: Device[];
  commands: DeviceCommand[];
  onSendCommand: (deviceId: string, vehicleId: string, commandType: CommandType, params?: Record<string, unknown>) => Promise<void>;
}

export const CommandsView: React.FC<CommandsViewProps> = ({
  vehicles,
  devices,
  commands,
  onSendCommand,
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [commandType, setCommandType] = useState<CommandType>(CommandType.POSITION_SINGLE);
  const [intervalSec, setIntervalSec] = useState(30);
  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedDevice = devices.find((d) => d.id === selectedVehicle?.deviceId);

  const handleSend = async (type?: CommandType) => {
    if (!selectedVehicle || !selectedDevice) return;
    const targetType = type || commandType;
    setIsSending(true);
    setSuccessMsg('');

    try {
      await onSendCommand(selectedDevice.id, selectedVehicle.id, targetType, {
        interval: intervalSec,
      });
      setSuccessMsg(`فرمان ${targetType} با موفقیت به ردیاب ارسال گردید.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.warn(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">ارسال دستورات کنترول از راه دور (Telecontrol)</h2>
        <p className="text-xs text-slate-500 mt-0.5">خاموش کردن موتر از راه دور، دریافت موقعیت فوری، تغییر فواصل ارسال پکت و ریبوت ردیاب</p>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Quick Commands */}
        <div className="bg-white border border-slate-100 p-5 rounded-xl space-y-4 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">انتخاب موتر و ردیاب مقصد</h3>

          <div>
            <label className="block text-xs text-slate-700 font-medium mb-1">واسطه نقلیه</label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} ({v.vehicleName})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100 text-xs space-y-2">
            <div className="flex justify-between text-slate-500">
              <span>شناسه ردیاب IMEI:</span>
              <span className="font-mono text-blue-600 font-bold">{selectedDevice?.imei || 'نامشخص'}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>پروتکل دستگاه:</span>
              <span className="font-mono text-slate-800">{selectedDevice?.protocol || 'GT06'}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>سیمکارت ردیاب:</span>
              <span className="text-slate-800 font-mono">{selectedDevice?.simNumber || 'ثبت نشده'}</span>
            </div>
          </div>

          {/* Emergency Engine Cut Box */}
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>فرمان امنیتی قطع برق/پمپ تیل</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              این فرمان در مواقع سرقت موتر پمپ تیل یا استارتر را از راه دور قطع می‌کند.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => handleSend(CommandType.ENGINE_STOP)}
                disabled={isSending}
                className="py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition flex items-center justify-center gap-1 shadow-xs"
              >
                <PowerOff className="w-3.5 h-3.5" />
                <span>قطع پمپ تیل</span>
              </button>
              <button
                onClick={() => handleSend(CommandType.ENGINE_RESUME)}
                disabled={isSending}
                className="py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition flex items-center justify-center gap-1 shadow-xs"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>وصل مجدد برق</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Custom Command Builder & History Log */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-slate-100 p-5 rounded-xl space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">سایر دستورات استاندارد</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => handleSend(CommandType.POSITION_SINGLE)}
                disabled={isSending}
                className="p-3.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-right transition"
              >
                <MapPin className="w-4 h-4 text-blue-600 mb-2" />
                <div className="text-xs font-bold text-slate-800">استعلام موقعیت آنی</div>
                <div className="text-[11px] text-slate-500 mt-0.5">درخواست فوری مختصات GPS</div>
              </button>

              <button
                onClick={() => handleSend(CommandType.REBOOT_DEVICE)}
                disabled={isSending}
                className="p-3.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-right transition"
              >
                <RotateCcw className="w-4 h-4 text-amber-600 mb-2" />
                <div className="text-xs font-bold text-slate-800">ریبوت سخت‌افزار (Reset)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">راه‌اندازی مجدد مودم ردیاب</div>
              </button>

              <button
                onClick={() => handleSend(CommandType.SET_REPORT_INTERVAL)}
                disabled={isSending}
                className="p-3.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-right transition"
              >
                <Clock className="w-4 h-4 text-indigo-600 mb-2" />
                <div className="text-xs font-bold text-slate-800">تنظیم فاصله ارسال (ثانیه)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">تنظیم روی {intervalSec} ثانیه</div>
              </button>
            </div>
          </div>

          {/* Commands Execution Log Table */}
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-slate-100 text-xs font-bold text-slate-800">تاریخچه فرامین ارسالی</div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-slate-500 text-[11px] font-bold border-b border-slate-200/80">
                  <tr>
                    <th className="p-3.5">نوع دستور</th>
                    <th className="p-3.5">موتر</th>
                    <th className="p-3.5">پکت خام ارسالی به مودم</th>
                    <th className="p-3.5">زمان ارسال</th>
                    <th className="p-3.5">وضعیت اجرا</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {commands.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 font-sans text-xs">
                        هنوز فرمانی ارسال نشده است.
                      </td>
                    </tr>
                  ) : (
                    commands.map((cmd) => (
                      <tr key={cmd.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3.5 font-bold text-blue-600">{cmd.commandType}</td>
                        <td className="p-3.5 text-slate-800 font-sans">{cmd.vehicleId}</td>
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">{cmd.rawPayload || '-'}</td>
                        <td className="p-3.5 text-slate-500">{new Date(cmd.createdAt).toLocaleTimeString('fa-AF')}</td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {cmd.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
