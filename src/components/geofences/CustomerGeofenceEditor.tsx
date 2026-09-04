import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Vehicle, Geofence, VehicleCurrentState } from '../../shared/types/models';
import { GeofenceType } from '../../shared/types/enums';
import {
  Shield,
  Plus,
  Minus,
  Layers,
  Edit2,
  Trash2,
  MapPin,
  Check,
  X,
  AlertCircle,
  Map as MapIcon,
  Navigation,
  ChevronDown,
  ChevronUp,
  Compass,
} from 'lucide-react';
import { MapTileTheme } from '../map/FleetMap';

const TILE_CONFIGS: Record<MapTileTheme, { url: string; label: string; attribution: string; sub: string }> = {
  osm_standard: {
    label: 'نقشه استاندارد خیابان‌ها (OSM)',
    sub: 'OpenStreetMap Standard Org - دقیق و بدون واترمارک',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    label: 'تصویر ماهواره‌ای HD (Satellite)',
    sub: 'ArcGIS World Imagery Satellite - وضوح بالا',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  osm_hot: {
    label: 'نقشه ترابری و جاده‌ها (HOT)',
    sub: 'Humanitarian OSM - تفکیک عالی راه‌ها',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  osm_voyager: {
    label: 'نقشه روشن و ملایم (Voyager)',
    sub: 'CartoDB Voyager Base',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  dark: {
    label: 'نقشه تم تیره (Night Mode)',
    sub: 'CartoDB Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
};

interface CustomerGeofenceEditorProps {
  vehicles: Vehicle[];
  geofences: Geofence[];
  selectedVehicleId?: string;
  currentStates?: VehicleCurrentState[];
  onSaveGeofence: (geofence: Partial<Geofence>, isEdit: boolean, existingId?: string) => Promise<boolean>;
  onDeleteGeofence: (id: string) => Promise<boolean>;
}

export const CustomerGeofenceEditor: React.FC<CustomerGeofenceEditorProps> = ({
  vehicles,
  geofences,
  selectedVehicleId,
  currentStates = [],
  onSaveGeofence,
  onDeleteGeofence,
}) => {
  const [activeVehicleId, setActiveVehicleId] = useState<string>(
    selectedVehicleId || (vehicles[0] ? vehicles[0].id : '')
  );

  useEffect(() => {
    if (selectedVehicleId) {
      setActiveVehicleId(selectedVehicleId);
    } else if (!activeVehicleId && vehicles[0]) {
      setActiveVehicleId(vehicles[0].id);
    }
  }, [selectedVehicleId, vehicles]);

  // View mode: false = Normal list & dropdown view, true = Full Interactive Map Mode
  const [isMapMode, setIsMapMode] = useState(false);

  // Accordion state: by default collapsed (hidden) as requested
  const [isListExpanded, setIsListExpanded] = useState(false);

  // Selected geofence from the dropdown in normal view
  const [selectedDropdownGfId, setSelectedDropdownGfId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Form states for creating or editing
  const [editingGeofenceId, setEditingGeofenceId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [centerLat, setCenterLat] = useState(34.5368);
  const [centerLng, setCenterLng] = useState(69.1724);
  const [notifyOnExit, setNotifyOnExit] = useState(true);
  const [notifyOnEnter, setNotifyOnEnter] = useState(false);
  const [isNameExpanded, setIsNameExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Map tile layer state and switcher
  const [mapTileLayer, setMapTileLayer] = useState<MapTileTheme>('osm_standard');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const circleLayerRef = useRef<L.Circle | null>(null);
  const markerLayerRef = useRef<L.Marker | null>(null);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  // Filter geofences for active vehicle
  const currentVehicleGeofences = geofences.filter((gf) => {
    if (!activeVehicleId) return false;
    return (
      gf.assignedVehicleIds.includes(activeVehicleId) ||
      gf.assignedVehicleIds.length === 0
    );
  });

  const activeVehicle = vehicles.find((v) => v.id === activeVehicleId);
  const activeVehicleState = currentStates.find((s) => s.vehicleId === activeVehicleId);

  // Currently assigned geofence for the active vehicle (single-geofence constraint)
  const currentlyAssignedGeofence = geofences.find((gf) =>
    gf.assignedVehicleIds && gf.assignedVehicleIds.includes(activeVehicleId)
  );

  // Sync dropdown when active vehicle changes: default to its currently assigned geofence if any
  useEffect(() => {
    if (currentlyAssignedGeofence) {
      setSelectedDropdownGfId(currentlyAssignedGeofence.id);
    } else {
      setSelectedDropdownGfId('');
    }
  }, [activeVehicleId, currentlyAssignedGeofence?.id]);

  // Start adding new geofence (transforms card into Map Mode)
  const handleStartAdd = () => {
    setEditingGeofenceId(null);
    setName('');
    setRadiusMeters(500);

    // If vehicle location is known, center on it; otherwise default to Kabul
    if (activeVehicleState && activeVehicleState.latitude && activeVehicleState.longitude) {
      setCenterLat(activeVehicleState.latitude);
      setCenterLng(activeVehicleState.longitude);
    } else {
      setCenterLat(34.5368);
      setCenterLng(69.1724);
    }

    setNotifyOnExit(true);
    setNotifyOnEnter(false);
    setIsNameExpanded(false);
    setFeedbackMsg(null);
    setIsMapMode(true);
  };

  // Mutually exclusive alert toggles
  const handleToggleExit = () => {
    setNotifyOnExit(true);
    setNotifyOnEnter(false);
  };

  const handleToggleEnter = () => {
    setNotifyOnEnter(true);
    setNotifyOnExit(false);
  };

  // Start editing existing geofence (transforms card into Map Mode)
  const handleStartEdit = (gf: Geofence) => {
    setEditingGeofenceId(gf.id);
    setName(gf.name);
    setRadiusMeters(gf.radiusMeters || 500);
    setCenterLat(gf.centerLatitude || 34.5368);
    setCenterLng(gf.centerLongitude || 69.1724);
    if (gf.notifyOnEnter && !gf.notifyOnExit) {
      setNotifyOnEnter(true);
      setNotifyOnExit(false);
    } else {
      setNotifyOnExit(true);
      setNotifyOnEnter(false);
    }
    setIsNameExpanded(true);
    setFeedbackMsg(null);
    setIsMapMode(true);
  };

  // Handle Confirm Assignment (تأیید پیوند محدوده به این موتر)
  const handleAssignGeofence = async () => {
    if (!selectedDropdownGfId || !activeVehicleId) return;
    setIsAssigning(true);
    try {
      // 1. Remove this vehicle from any other geofence currently holding it (1-vehicle = 1-geofence constraint)
      for (const gf of geofences) {
        if (gf.id !== selectedDropdownGfId && gf.assignedVehicleIds?.includes(activeVehicleId)) {
          const updatedVehicles = gf.assignedVehicleIds.filter((id) => id !== activeVehicleId);
          await onSaveGeofence({ assignedVehicleIds: updatedVehicles }, true, gf.id);
        }
      }

      // 2. Add this vehicle to the newly selected geofence
      const targetGf = geofences.find((g) => g.id === selectedDropdownGfId);
      if (targetGf) {
        const currentIds = targetGf.assignedVehicleIds || [];
        if (!currentIds.includes(activeVehicleId)) {
          const ok = await onSaveGeofence(
            { assignedVehicleIds: [...currentIds, activeVehicleId] },
            true,
            targetGf.id
          );
          if (ok) {
            setFeedbackMsg({
              type: 'success',
              text: 'محدوده با موفقیت به موتر متصل و تأیید شد.',
            });
            setTimeout(() => setFeedbackMsg(null), 2500);
          } else {
            setFeedbackMsg({
              type: 'error',
              text: 'خطا در اتصال محدوده به موتر.',
            });
          }
        } else {
          setFeedbackMsg({
            type: 'success',
            text: 'این محدوده از قبل برای این موتر فعال است.',
          });
          setTimeout(() => setFeedbackMsg(null), 2500);
        }
      }
    } catch (err) {
      console.error('[CustomerGeofenceEditor] Error assigning geofence:', err);
      setFeedbackMsg({ type: 'error', text: 'خطا در انجام عملیات.' });
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle Cancel Assignment (لغو پیوند و برداشتن محدوده از موتر)
  const handleUnassignGeofence = async () => {
    if (!activeVehicleId) return;
    setIsAssigning(true);
    try {
      let removedAny = false;
      for (const gf of geofences) {
        if (gf.assignedVehicleIds?.includes(activeVehicleId)) {
          const updatedVehicles = gf.assignedVehicleIds.filter((id) => id !== activeVehicleId);
          const ok = await onSaveGeofence({ assignedVehicleIds: updatedVehicles }, true, gf.id);
          if (ok) removedAny = true;
        }
      }

      setSelectedDropdownGfId('');
      if (removedAny) {
        setFeedbackMsg({
          type: 'success',
          text: 'محدوده از این موتر لغو و برداشته شد.',
        });
      } else {
        setFeedbackMsg({
          type: 'success',
          text: 'محدوده‌ای به این موتر متصل نبود.',
        });
      }
      setTimeout(() => setFeedbackMsg(null), 2500);
    } catch (err) {
      console.error('[CustomerGeofenceEditor] Error unassigning geofence:', err);
      setFeedbackMsg({ type: 'error', text: 'خطا در لغو محدوده.' });
    } finally {
      setIsAssigning(false);
    }
  };

  // Center on Vehicle location while in map mode
  const handleCenterOnVehicle = () => {
    if (activeVehicleState && activeVehicleState.latitude && activeVehicleState.longitude) {
      const { latitude, longitude } = activeVehicleState;
      setCenterLat(latitude);
      setCenterLng(longitude);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([latitude, longitude], 15);
      }
      if (markerLayerRef.current) {
        markerLayerRef.current.setLatLng([latitude, longitude]);
      }
      if (circleLayerRef.current) {
        circleLayerRef.current.setLatLng([latitude, longitude]);
      }
    }
  };

  // Initialize and manage the Leaflet Map when in Map Mode
  useEffect(() => {
    if (!isMapMode || !mapContainerRef.current) return;

    // Destroy any existing instance before initializing
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    const cfg = TILE_CONFIGS[mapTileLayer];
    const initialLayer = L.tileLayer(cfg.url, {
      maxZoom: 19,
      attribution: cfg.attribution,
    }).addTo(map);
    activeTileLayerRef.current = initialLayer;

    // Custom Draggable Pin Icon
    const pinIcon = L.divIcon({
      className: 'custom-geofence-center-pin',
      html: `<div style="
        background-color: #2563EB;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 3px solid #ffffff;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
      ">
        <div style="width: 8px; height: 8px; background-color: #ffffff; border-radius: 50%;"></div>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([centerLat, centerLng], {
      icon: pinIcon,
      draggable: true,
    }).addTo(map);
    markerLayerRef.current = marker;

    const circle = L.circle([centerLat, centerLng], {
      radius: radiusMeters,
      color: '#2563EB',
      fillColor: '#3B82F6',
      fillOpacity: 0.22,
      weight: 2.5,
    }).addTo(map);
    circleLayerRef.current = circle;

    // Map Click: move center pin & circle
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setCenterLat(lat);
      setCenterLng(lng);
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
    });

    // Marker Drag: update center
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setCenterLat(pos.lat);
      setCenterLng(pos.lng);
      circle.setLatLng(pos);
    });

    mapInstanceRef.current = map;

    // Ensure map tiles render properly after container is visible
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isMapMode]);

  // Handle Tile Layer Switch dynamically
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }

    const cfg = TILE_CONFIGS[mapTileLayer];
    const newLayer = L.tileLayer(cfg.url, {
      maxZoom: 19,
      attribution: cfg.attribution,
    }).addTo(map);

    newLayer.bringToBack();
    activeTileLayerRef.current = newLayer;
  }, [mapTileLayer]);

  // Update circle radius live on slider change
  useEffect(() => {
    if (circleLayerRef.current) {
      circleLayerRef.current.setRadius(radiusMeters);
    }
  }, [radiusMeters]);

  // Submit handler (Save Geofence)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalName = name.trim();
    if (!finalName) {
      if (!isNameExpanded) {
        setIsNameExpanded(true);
        setFeedbackMsg({ type: 'error', text: 'لطفاً نامی برای این محدوده وارد کنید.' });
        return;
      }
      finalName = `محدوده ${currentVehicleGeofences.length + 1}`;
    }

    setIsSaving(true);
    setFeedbackMsg(null);

    const payload: Partial<Geofence> = {
      name: finalName,
      type: GeofenceType.CIRCLE,
      centerLatitude: centerLat,
      centerLongitude: centerLng,
      radiusMeters,
      color: '#2563EB',
      assignedVehicleIds: [activeVehicleId],
      notifyOnExit,
      notifyOnEnter,
    };

    const isEdit = !!editingGeofenceId;
    const success = await onSaveGeofence(payload, isEdit, editingGeofenceId || undefined);

    setIsSaving(false);
    if (success) {
      setFeedbackMsg({
        type: 'success',
        text: isEdit ? 'محدوده با موفقیت ویرایش شد.' : 'محدوده جغرافیایی با موفقیت ثبت و پایش فعال شد.',
      });
      setTimeout(() => {
        setIsMapMode(false);
        setEditingGeofenceId(null);
        setFeedbackMsg(null);
      }, 1000);
    } else {
      setFeedbackMsg({ type: 'error', text: 'خطا در ثبت اطلاعات، لطفاً مجدداً بررسی نمایید.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('آیا از حذف این محدوده جغرافیایی اطمینان دارید؟')) return;
    const ok = await onDeleteGeofence(id);
    if (ok) {
      setFeedbackMsg({ type: 'success', text: 'محدوده با موفقیت حذف شد.' });
      setTimeout(() => setFeedbackMsg(null), 2500);
    }
  };

  return (
    <div className="text-right" dir="rtl">
      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-2.5 mb-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: NORMAL VIEW (DROPDOWN + ACTION BUTTON + REGISTERED COORDINATES LIST) */}
      {/* ========================================================================= */}
      {!isMapMode && (
        <div className="space-y-4">
          {/* Top Row: Vehicle Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-800">دستگاه مورد نظر:</label>
              <span className="text-[11px] text-slate-500">انتخاب موتر جهت مدیریت محدوده‌ها</span>
            </div>

            <select
              value={activeVehicleId}
              onChange={(e) => {
                setActiveVehicleId(e.target.value);
                setSelectedDropdownGfId('');
              }}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 font-mono shadow-xs cursor-pointer"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} - {v.vehicleName}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Menu for Defined Geofences with Confirm and Cancel buttons */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                منوی کشویی محدوده‌های تعریف‌شده:
              </label>
              <div className="flex items-center gap-1.5">
                {currentlyAssignedGeofence && (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    متصل به: {currentlyAssignedGeofence.name}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-mono">
                  ({geofences.length} محدوده)
                </span>
              </div>
            </div>

            <div className="relative">
              <select
                value={selectedDropdownGfId}
                onChange={(e) => setSelectedDropdownGfId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer appearance-none pl-8"
              >
                <option value="">-- انتخاب یک محدوده از لیست کشویی --</option>
                {geofences.map((gf) => (
                  <option key={gf.id} value={gf.id}>
                    {gf.name} (شعاع: {gf.radiusMeters || 500}متر)
                    {gf.assignedVehicleIds?.includes(activeVehicleId) ? ' [فعال برای این موتر]' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Action Buttons for Assignment: Confirm (تأیید) & Cancel (لغو) */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleAssignGeofence}
                disabled={
                  !selectedDropdownGfId ||
                  isAssigning ||
                  currentlyAssignedGeofence?.id === selectedDropdownGfId
                }
                title="تأیید اختصاص این محدوده به موتر انتخابی"
                className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shadow-xs active:scale-98"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تأیید</span>
              </button>

              <button
                type="button"
                onClick={handleUnassignGeofence}
                disabled={!currentlyAssignedGeofence || isAssigning}
                title="لغو محدوده از این موتر"
                className="flex-1 py-1.5 px-3 rounded-lg bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shadow-xs active:scale-98"
              >
                <X className="w-3.5 h-3.5" />
                <span>لغو</span>
              </button>
            </div>
          </div>

          {/* Primary Action: Transform to Map Mode */}
          <button
            type="button"
            onClick={handleStartAdd}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer active:scale-98"
          >
            <MapIcon className="w-4 h-4" />
            <span>+ تعریف محدوده جدید روی نقشه</span>
          </button>

          {/* Registered Coordinates & Geofences List - Collapsible Accordion (Closed by default, 2-card max scroll view) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => setIsListExpanded((prev) => !prev)}
              className="w-full px-3.5 py-3 flex items-center justify-between text-right hover:bg-slate-100/80 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    لیست مختصات و محدوده‌های ثبت‌شده ({geofences.length})
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {isListExpanded ? 'جهت بستن کلیک کنید' : 'جهت مشاهده محدوده‌ها کلیک کنید'}
                  </span>
                </div>
              </div>
              <div className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 shadow-2xs">
                {isListExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {/* Accordion Content: Shows when expanded, bounded to 2 cards with smooth vertical scroll */}
            {isListExpanded && (
              <div className="p-2.5 border-t border-slate-200 bg-white space-y-2">
                {geofences.length === 0 ? (
                  <div className="p-4 text-center space-y-1">
                    <p className="text-xs font-bold text-slate-700">هیچ محدوده جغرافیایی ثبت نشده است.</p>
                    <p className="text-[11px] text-slate-500">
                      با کلیک روی دکمه «تعریف محدوده جدید روی نقشه» اولین محدوده خود را بسازید.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[220px] overflow-y-auto space-y-2 pr-0.5">
                    {geofences.map((gf) => {
                      const isAssignedToActive = gf.assignedVehicleIds?.includes(activeVehicleId);
                      return (
                        <div
                          key={gf.id}
                          className={`border rounded-xl p-2.5 transition space-y-1.5 ${
                            isAssignedToActive
                              ? 'bg-blue-50/50 border-blue-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  isAssignedToActive ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-blue-600'
                                }`}
                              />
                              <span className="text-xs font-bold text-slate-900">{gf.name}</span>
                              {isAssignedToActive && (
                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-sm">
                                  متصل به این موتر
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100 shrink-0">
                              شعاع: {gf.radiusMeters || 500} متر
                            </span>
                          </div>

                          {/* Exact Coordinates Display */}
                          <div className="bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-600">
                            <span className="flex items-center gap-1 font-sans text-slate-500 text-[10px]">
                              <Compass className="w-3 h-3 text-blue-600" />
                              <span>مرکز:</span>
                            </span>
                            <span className="font-bold text-slate-800">
                              {gf.centerLatitude ? gf.centerLatitude.toFixed(4) : '34.5368'} ,{' '}
                              {gf.centerLongitude ? gf.centerLongitude.toFixed(4) : '69.1724'}
                            </span>
                          </div>

                          {/* Alerts & Actions Row */}
                          <div className="flex items-center justify-between pt-1 text-[11px]">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span className={gf.notifyOnExit ? 'text-amber-700 font-medium' : 'text-slate-400'}>
                                {gf.notifyOnExit ? '✓ خروج' : '✕ بدون خروج'}
                              </span>
                              <span>•</span>
                              <span className={gf.notifyOnEnter ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                                {gf.notifyOnEnter ? '✓ ورود' : '✕ بدون ورود'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(gf)}
                                className="px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 rounded-md transition flex items-center gap-1 cursor-pointer border border-slate-200"
                              >
                                <Edit2 className="w-3 h-3 text-blue-600" />
                                <span>ویرایش روی نقشه</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(gf.id)}
                                className="px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 rounded-md transition flex items-center gap-1 cursor-pointer border border-rose-200"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>حذف</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: FULL MAP MODE (CLEAN INTERACTIVE MAP WITH UNOBSTRUCTED VIEW) */}
      {/* ========================================================================= */}
      {isMapMode && (
        <div className="relative w-full h-[540px] sm:h-[580px] rounded-2xl overflow-hidden border border-slate-300 shadow-xl bg-slate-100">
          {/* Top Left Controls: Zoom & Layer Switcher (Beside + and -) */}
          <div className="absolute top-3 left-3 z-[1000] flex items-start gap-1.5">
            {/* Zoom In / Out Buttons */}
            <div className="flex flex-col bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200/80 overflow-hidden">
              <button
                type="button"
                onClick={handleZoomIn}
                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-700 border-b border-slate-100 transition cursor-pointer active:scale-95"
                title="بزرگ‌نمایی"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-700 transition cursor-pointer active:scale-95"
                title="کوچک‌نمایی"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Layer Switcher Button & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLayerMenu(!showLayerMenu)}
                className={`w-8 h-8 rounded-xl bg-white/95 backdrop-blur-md text-slate-700 shadow-md hover:bg-white border transition active:scale-95 flex items-center justify-center cursor-pointer ${
                  showLayerMenu ? 'border-blue-500 text-blue-600 ring-2 ring-blue-100' : 'border-slate-200/80'
                }`}
                title="انتخاب لایه نقشه"
              >
                <Layers className="w-4 h-4 text-blue-600" />
              </button>

              {/* Layer Selection Popup Menu */}
              {showLayerMenu && (
                <div className="absolute top-full left-0 mt-1.5 w-60 bg-white/98 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 p-1.5 space-y-1 text-right dir-rtl z-[1100] animate-fadeIn">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-500">
                    <span>انتخاب لایه نقشه</span>
                    <button
                      type="button"
                      onClick={() => setShowLayerMenu(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {(Object.keys(TILE_CONFIGS) as MapTileTheme[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setMapTileLayer(key);
                        setShowLayerMenu(false);
                      }}
                      className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer ${
                        mapTileLayer === key
                          ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5 leading-tight">
                        <div className="text-[11px] font-bold">{TILE_CONFIGS[key].label}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{TILE_CONFIGS[key].sub}</div>
                      </div>
                      {mapTileLayer === key && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Minimal Floating Corner Controls */}
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsMapMode(false);
                setEditingGeofenceId(null);
              }}
              className="w-9 h-9 rounded-full bg-white/95 text-slate-700 hover:bg-white hover:text-rose-600 shadow-md border border-slate-200/80 flex items-center justify-center transition cursor-pointer active:scale-95"
              title="بستن نقشه و انصراف"
            >
              <X className="w-4 h-4" />
            </button>

            {activeVehicleState && (
              <button
                type="button"
                onClick={handleCenterOnVehicle}
                className="h-9 px-3 rounded-full bg-white/95 text-slate-700 hover:text-blue-600 shadow-md border border-slate-200/80 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                title="موقعیت دستگاه"
              >
                <Navigation className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px]">موقعیت دستگاه</span>
              </button>
            )}
          </div>

          {/* Leaflet Map Canvas (Takes 100% of the container) */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Bottom Floating Card (Clean, Collapsible & Non-intrusive) */}
          <form
            onSubmit={handleSubmit}
            className="absolute bottom-3 left-3 right-3 z-[1000] bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-slate-200/90 space-y-2.5 transition-all duration-200"
          >
            {/* Optional Collapsed/Expanded: Name / Search Field */}
            {isNameExpanded && (
              <div className="pt-0.5 space-y-1 animate-fadeIn">
                <label className="block text-[11px] font-bold text-slate-700">
                  نام محدوده (ساحه):
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: خانه، پارکینگ، انبار، شرکت..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-inner"
                  autoFocus
                />
              </div>
            )}

            {/* Row 1: Radius Slider with distance badge and chevron toggle for name */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-[11px]">شعاع محدوده:</span>
                  <span className="font-mono font-bold text-blue-600 text-xs bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {radiusMeters >= 1000 ? `${(radiusMeters / 1000).toFixed(1)} کیلومتر` : `${radiusMeters} متر`}
                  </span>
                </div>

                {/* Chevron toggle button */}
                <button
                  type="button"
                  onClick={() => setIsNameExpanded(!isNameExpanded)}
                  className="text-slate-600 hover:text-blue-600 text-[11px] font-medium flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition cursor-pointer"
                  title={isNameExpanded ? 'بستن فیلد نام' : 'تعیین نام محدوده'}
                >
                  <span>{isNameExpanded ? 'بستن نام' : 'تنظیم نام'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isNameExpanded ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </button>
              </div>

              <input
                type="range"
                min={100}
                max={5000}
                step={50}
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10))}
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
            </div>

            {/* Row 2: Alert Toggles (Mutually Exclusive: Exit default ON, Enter OFF) */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
              <span className="text-slate-500 text-[11px] font-medium">نوع هشدار:</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-medium select-none">
                  <input
                    type="checkbox"
                    checked={notifyOnExit}
                    onChange={handleToggleExit}
                    className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[11px]">هشدار خروج</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-medium select-none">
                  <input
                    type="checkbox"
                    checked={notifyOnEnter}
                    onChange={handleToggleEnter}
                    className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[11px]">هشدار ورود</span>
                </label>
              </div>
            </div>

            {/* Row 3: Action Buttons (Cancel and Submit) */}
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMapMode(false);
                  setEditingGeofenceId(null);
                }}
                className="w-1/3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="w-2/3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white text-xs font-bold shadow-md cursor-pointer active:scale-98 transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'در حال ثبت...' : editingGeofenceId ? 'ذخیره تغییرات' : 'تایید و ثبت نهایی'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
