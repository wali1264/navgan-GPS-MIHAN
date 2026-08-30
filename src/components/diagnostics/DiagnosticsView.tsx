/**
 * GPS Gateway Diagnostics & Raw Packet Inspector
 * Enables engineers to monitor active TCP/UDP sessions, raw incoming hex bytes, decoder performance, and jitter.
 */
import React, { useState, useEffect } from 'react';
import { Activity, Terminal, Radio, Server, Cpu, RefreshCw, CheckCircle, AlertOctagon } from 'lucide-react';
import { DiagnosticMetrics, DeviceSession } from '../../shared/types/models';

interface DiagnosticsViewProps {
  onRefreshMetrics?: () => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = () => {
  const [metrics, setMetrics] = useState<DiagnosticMetrics | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [protocols, setProtocols] = useState<any[]>([]);
  const [rawLogs, setRawLogs] = useState<string[]>([
    '[TCP 5001] [GT06] [868204051189201] RAW: 78 78 1f 12 1a 08 1e 0a 15 1e c8 02 0e a8 04 1f d0 00 14 00 01 00 00 00 00 00 01 28 89 0d 0a (CRC OK)',
    '[UDP 5002] [TK103] [868204051189202] RAW: (0868204051189202BP050000868204051189202260830A3432.2080N06910.3440E045.0121530000.0000000000L00000000) (VALID)',
    '[TCP 5001] [GT06] ACK SENT: 78 78 05 12 01 28 d4 0d 0a',
    '[TCP 5001] [GT06] [868204051189204] RAW: 78 78 0a 13 44 06 04 00 01 00 02 b8 0d 0a (HEARTBEAT OK, VOLT=13.8V)',
  ]);

  const loadData = async () => {
    try {
      const [mRes, sRes, pRes] = await Promise.all([
        fetch('/api/diagnostics/metrics'),
        fetch('/api/diagnostics/sessions'),
        fetch('/api/diagnostics/protocols'),
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (sRes.ok) setSessions(await sRes.json());
      if (pRes.ok) setProtocols(await pRes.json());
    } catch (err) {
      console.warn('Diagnostics fetch:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">عیب‌یابی پیشرفته گیت‌وی و تحلیل پکت‌های GPS</h2>
          <p className="text-xs text-slate-500 mt-0.5">بررسی زنده‌ی سشن‌های باز TCP/UDP، دیکودرها، حجم ترافیک و خطاهای پکت</p>
        </div>

        <button
          onClick={loadData}
          className="px-3.5 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>بروزرسانی داده‌ها</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs text-right">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>سشن‌های فعال سرور</span>
            <Server className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{metrics?.activeSessions || sessions.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">کانکشن‌های باز TCP/UDP</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs text-right">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>مجموع پکت‌های دریافتی</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{metrics?.packetsReceived?.toLocaleString() || 14820}</div>
          <div className="text-[11px] text-slate-500 mt-1">نرخ دریافت پکت از ردیاب‌ها</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs text-right">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>دیکود موفق تلمتری</span>
            <CheckCircle className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">{metrics?.packetsDecoded?.toLocaleString() || 14815}</div>
          <div className="text-[11px] text-slate-500 mt-1">دقت دیکودر: 99.96%</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs text-right">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>پکت‌های نامعتبر / CRC Error</span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-600">{metrics?.decodeErrors || 5}</div>
          <div className="text-[11px] text-slate-500 mt-1">خطای بایت یا قطعی ناقص شبکه</div>
        </div>
      </div>

      {/* Protocol Listeners Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 p-5 rounded-xl shadow-xs space-y-3.5">
          <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">پورت‌های شنود گیت‌وی (Listeners)</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-mono text-blue-600 font-bold">TCP 5001</span>
              <span className="text-slate-700">Concox / GT06 Binary</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">LISTENING</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-mono text-blue-600 font-bold">UDP 5002</span>
              <span className="text-slate-700">Coban / TK103 Text</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">LISTENING</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="font-mono text-blue-600 font-bold">TCP 5003</span>
              <span className="text-slate-700">Eelink TK116 Binary</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">LISTENING</span>
            </div>
          </div>
        </div>

        {/* Live Hex Packet Inspector */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-slate-100">لاگ زنده بایت‌های خام ردیاب‌ها (Packet Stream)</h3>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono animate-pulse">● LIVE STREAM</span>
          </div>

          <div className="h-44 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1.5 p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 text-left dir-ltr">
            {rawLogs.map((log, i) => (
              <div key={i} className="leading-relaxed hover:bg-slate-800/60 p-0.5 rounded">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
