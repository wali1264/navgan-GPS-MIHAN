/**
 * Trip History & Route Playback View
 * Streamlined for mobile: Receives selected vehicle and active filter directly,
 * displays route history, performance metrics, and smooth animation playback.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Vehicle, PositionRecord } from '../../shared/types/models';
import { FleetMap } from '../map/FleetMap';
import { calculateTotalRouteDistance } from '../../utils/geo-calculator';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Clock,
  Route,
  Car,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export type TripHistoryFilter = 'today' | 'yesterday' | 'week' | 'month';

interface TripHistoryViewProps {
  vehicles: Vehicle[];
  selectedVehicleId?: string;
  activeFilter?: TripHistoryFilter;
  onLoadHistory: (vehicleId: string, startTime: string, endTime: string) => Promise<PositionRecord[]>;
}

export const TripHistoryView: React.FC<TripHistoryViewProps> = ({
  vehicles,
  selectedVehicleId,
  activeFilter = 'today',
  onLoadHistory,
}) => {
  const [showStats, setShowStats] = useState(false);
  const [historyData, setHistoryData] = useState<PositionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Compute ISO Start and End based on active filter
  const getDateRange = () => {
    const now = new Date();

    if (activeFilter === 'today') {
      // From 00:00:00.000 today to 23:59:59.999 today
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    if (activeFilter === 'yesterday') {
      // Strictly yesterday: from 00:00:00.000 to 23:59:59.999 yesterday
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    if (activeFilter === 'week') {
      // Last 7 days: 6 days ago 00:00:00.000 to end of today 23:59:59.999
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    // Default 30 days: 29 days ago 00:00:00.000 to end of today 23:59:59.999
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  useEffect(() => {
    if (!selectedVehicleId) {
      setHistoryData([]);
      setIsLoading(false);
      setIsPlaying(false);
      setPlaybackIndex(0);
      return;
    }

    let isMounted = true;
    const fetchHistory = async () => {
      setIsLoading(true);
      setIsPlaying(false);
      try {
        const { start, end } = getDateRange();
        const data = await onLoadHistory(selectedVehicleId, start, end);
        if (isMounted) {
          setHistoryData(data || []);
          setPlaybackIndex(0);
        }
      } catch (err) {
        console.warn('Failed to load history:', err);
        if (isMounted) setHistoryData([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [selectedVehicleId, activeFilter]);

  // Animation Loop for Playback
  useEffect(() => {
    if (!isPlaying || historyData.length === 0) return;

    const interval = setInterval(() => {
      setPlaybackIndex((prev) => {
        if (prev >= historyData.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 400 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, historyData, playbackSpeed]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const currentPoint = historyData[playbackIndex];
  const maxSpeed = historyData.reduce((max, p) => Math.max(max, p.speed), 0);
  const avgSpeed =
    historyData.length > 0
      ? Math.round(historyData.reduce((sum, p) => sum + p.speed, 0) / historyData.length)
      : 0;
  const totalDistance = useMemo(() => {
    return calculateTotalRouteDistance(historyData);
  }, [historyData]);

  // If no vehicle is selected yet: Render clean full map without extra banner
  if (!selectedVehicleId) {
    return (
      <div className="h-[460px] sm:h-[540px] rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-white relative">
        <FleetMap
          vehicles={vehicles}
          currentStates={[]}
          routeHistory={[]}
          className="w-full h-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2.5 flex flex-col">
      {/* Metrics Summary Strip (Only visible when a vehicle is selected) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          onClick={() => setShowStats(!showStats)}
          className="w-full p-2.5 text-xs font-bold text-slate-700 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Route className="w-3.5 h-3.5 text-blue-600" />
            <span>مسافت طی‌شده: <strong className="text-blue-700 font-mono">{totalDistance} km</strong></span>
            <span className="text-slate-300">•</span>
            <span>سرعت اوسط: <strong className="text-emerald-700 font-mono">{avgSpeed} km/h</strong></span>
            {selectedVehicle && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-mono">{selectedVehicle.plateNumber}</span>
              </>
            )}
          </div>
          {showStats ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showStats && (
          <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-rose-600" />
              <span>حداکثر سرعت: <strong className="text-slate-900 font-mono">{maxSpeed} km/h</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>نقاط ثبت‌شده: <strong className="text-slate-900 font-mono">{historyData.length}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Map Display with Route */}
      <div className="h-[380px] sm:h-[480px] rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-white relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-[500] flex items-center justify-center text-xs font-bold text-slate-700">
            در حال بارگذاری تاریخچه مسیر...
          </div>
        )}
        <FleetMap
          vehicles={vehicles}
          currentStates={[]}
          routeHistory={historyData}
          historyPlaybackIndex={historyData.length > 0 ? playbackIndex : undefined}
          className="w-full h-full"
        />
      </div>

      {/* Playback Controls: Compact for Mobile */}
      {historyData.length > 0 ? (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
          {/* Progress Slider */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 text-[11px]">نقطه ۱</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, historyData.length - 1)}
              value={playbackIndex}
              onChange={(e) => setPlaybackIndex(parseInt(e.target.value, 10))}
              className="flex-1 accent-blue-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
            />
            <span className="text-blue-600 font-bold text-[11px]">
              {playbackIndex + 1}/{historyData.length}
            </span>
          </div>

          {/* Buttons & Live Telemetry Point */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer active:scale-95"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'توقف' : 'پخش انیمیشن'}</span>
              </button>

              <button
                onClick={() => {
                  setIsPlaying(false);
                  setPlaybackIndex(0);
                }}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition shadow-xs cursor-pointer"
                title="شروع مجدد"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>

            {currentPoint && (
              <div className="text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-100 text-slate-700 flex items-center gap-2">
                <span>⚡ <strong className="text-blue-600 font-mono">{currentPoint.speed}</strong> km/h</span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-600">
                  {new Date(currentPoint.timestamp).toLocaleTimeString('fa-AF', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
          برای این بازه زمانی ترددی برای این دستگاه ثبت نشده است.
        </div>
      )}
    </div>
  );
};
