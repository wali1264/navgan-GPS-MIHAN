/**
 * Full-Featured Interactive Leaflet Fleet Map
 * Powered by OpenStreetMap (OSM) and High-Resolution Free Tile Layers.
 * Features Google Maps-like clean street styling, Satellite HD, HOT Transport, and Dark Mode.
 * Supports real-time vehicle positioning, rotation headings, geofences, route polylines,
 * and high-density telemetry popups in Persian/Dari.
 */
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Vehicle, VehicleCurrentState, Geofence, PositionRecord } from '../../shared/types/models';
import { VehicleStatus, GeofenceType } from '../../shared/types/enums';
import { Layers, Maximize2, Shield, Plus, Minus, Compass, MapPin, Radio, Check } from 'lucide-react';

interface FleetMapProps {
  vehicles: Vehicle[];
  currentStates: VehicleCurrentState[];
  geofences?: Geofence[];
  selectedVehicleId?: string;
  onSelectVehicle?: (vehicleId: string) => void;
  routeHistory?: PositionRecord[];
  historyPlaybackIndex?: number;
  className?: string;
}

export type MapTileTheme = 'osm_voyager' | 'osm_standard' | 'osm_hot' | 'satellite' | 'dark';

export const FleetMap: React.FC<FleetMapProps> = ({
  vehicles,
  currentStates,
  geofences = [],
  selectedVehicleId,
  onSelectVehicle,
  routeHistory = [],
  historyPlaybackIndex,
  className = 'h-full min-h-[450px]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const geofenceLayersRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const playbackMarkerRef = useRef<L.Marker | null>(null);

  const [mapTileLayer, setMapTileLayer] = useState<MapTileTheme>('osm_standard');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showGeofences, setShowGeofences] = useState(true);
  const [followSelected, setFollowSelected] = useState(true);

  // Map Tile Definitions (All 100% Free & Open Source OSM based - Zero Watermark)
  const TILE_CONFIGS: Record<MapTileTheme, { url: string; label: string; attribution: string; sub: string }> = {
    osm_standard: {
      label: 'نقشه استاندارد خیابان‌ها (OSM)',
      sub: 'OpenStreetMap Standard Org - دقیق و بدون واترمارک',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    osm_hot: {
      label: 'نقشه ترابری و جاده‌ها (HOT)',
      sub: 'Humanitarian OSM - تفکیک عالی راه‌ها و بزرگراه‌ها',
      url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by Humanitarian OpenStreetMap Team',
    },
    satellite: {
      label: 'تصویر ماهواره‌ای HD (Satellite)',
      sub: 'ArcGIS World Imagery Satellite - وضوح بالا',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    },
    osm_voyager: {
      label: 'نقشه روشن و ملایم (Voyager)',
      sub: 'CartoDB Voyager Base',
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    dark: {
      label: 'نقشه تم تیره (Night Mode)',
      sub: 'CartoDB Dark Matter',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [34.5368, 69.1724], // Kabul Center
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    });

    // Metric Scale Bar
    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);

    // Initial Base Tile Layer
    const cfg = TILE_CONFIGS[mapTileLayer];
    const initialLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 19,
    }).addTo(map);

    activeTileLayerRef.current = initialLayer;
    geofenceLayersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Tile Layer Switch
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }

    const cfg = TILE_CONFIGS[mapTileLayer];
    const newLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 19,
    }).addTo(map);

    activeTileLayerRef.current = newLayer;
  }, [mapTileLayer]);

  // Render / Update Vehicle Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const currentMarkerIds = new Set<string>();

    currentStates.forEach((state) => {
      const vehicle = vehicles.find((v) => v.id === state.vehicleId);
      if (!vehicle) return;

      currentMarkerIds.add(state.vehicleId);

      // Marker Icon Styling
      const isMoving = state.onlineStatus === VehicleStatus.MOVING;
      const isIdle = state.onlineStatus === VehicleStatus.IDLE;
      const isStopped = state.onlineStatus === VehicleStatus.STOPPED;

      const bgBadgeColor = isMoving
        ? 'bg-emerald-600 text-white shadow-md'
        : isIdle
        ? 'bg-amber-500 text-white shadow-md'
        : isStopped
        ? 'bg-blue-600 text-white shadow-md'
        : 'bg-slate-500 text-white';

      const isSelected = selectedVehicleId === state.vehicleId;
      const ringClass = isSelected ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-white scale-115' : '';

      const customHtml = `
        <div class="relative flex flex-col items-center group cursor-pointer transition-transform">
          <div class="w-8 h-8 rounded-full ${bgBadgeColor} ${ringClass} flex items-center justify-center shadow-md border-2 border-white transition-all duration-300" style="transform: rotate(${state.heading || 0}deg)">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
          <div class="absolute -bottom-5 bg-white text-[11px] font-bold text-slate-800 px-2 py-0.5 rounded shadow border border-slate-200 whitespace-nowrap pointer-events-none font-mono">
            ${vehicle.plateNumber}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-vehicle-marker',
        html: customHtml,
        iconSize: [32, 40],
        iconAnchor: [16, 20],
      });

      let marker = markersRef.current.get(state.vehicleId);

      if (!marker) {
        marker = L.marker([state.latitude, state.longitude], { icon: customIcon });
        marker.on('click', () => {
          if (onSelectVehicle) {
            onSelectVehicle(state.vehicleId);
          }
        });
        marker.addTo(map);
        markersRef.current.set(state.vehicleId, marker);
      } else {
        marker.setLatLng([state.latitude, state.longitude]);
        marker.setIcon(customIcon);
      }

      // Detailed Telemetry Popup
      const statusText = isMoving ? 'در حال حرکت' : isIdle ? 'روشن و درجا' : isStopped ? 'پارک / متوقف' : 'آفلاین';
      const statusBadge = isMoving
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : isIdle
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : isStopped
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';

      const popupHtml = `
        <div class="p-2 space-y-2 text-right dir-rtl font-sans min-w-[220px] bg-white rounded-lg">
          <div class="flex items-center justify-between border-b border-slate-100 pb-2">
            <span class="text-xs font-bold text-slate-900 font-mono">${vehicle.plateNumber}</span>
            <span class="text-[10px] px-2 py-0.5 rounded border font-medium ${statusBadge}">${statusText}</span>
          </div>
          <div class="text-xs font-semibold text-slate-700">${vehicle.vehicleName}</div>
          <div class="grid grid-cols-2 gap-1.5 text-xs text-slate-600 pt-1 bg-slate-50 p-2 rounded border border-slate-100">
            <div>⚡ سرعت: <strong class="text-slate-900 font-mono">${state.speed}</strong> km/h</div>
            <div>🔑 سویچ: <strong class="${state.ignition ? 'text-emerald-700' : 'text-slate-500'}">${state.ignition ? 'روشن' : 'خاموش'}</strong></div>
            <div>🔋 بطری: <strong class="text-slate-900 font-mono">${state.batteryVoltage || 12.6}V</strong></div>
            <div>📡 آنتن: <strong class="text-slate-900 font-mono">${state.gsmSignal || 85}%</strong></div>
          </div>
          <div class="text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 flex items-center gap-1">
            <span>📍 ${state.address || 'موقعیت GPS ثبت شده'}</span>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml);
    });

    // Clean up removed markers
    markersRef.current.forEach((marker, id) => {
      if (!currentMarkerIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });

    // Auto-focus selected vehicle
    if (selectedVehicleId && followSelected) {
      const selectedState = currentStates.find((s) => s.vehicleId === selectedVehicleId);
      if (selectedState) {
        map.panTo([selectedState.latitude, selectedState.longitude], { animate: true });
      }
    }
  }, [currentStates, vehicles, selectedVehicleId, followSelected, onSelectVehicle]);

  // Render Geofences
  useEffect(() => {
    if (!mapInstanceRef.current || !geofenceLayersRef.current) return;
    geofenceLayersRef.current.clearLayers();

    if (!showGeofences) return;

    geofences.forEach((gf) => {
      if (gf.type === GeofenceType.CIRCLE && gf.centerLatitude && gf.centerLongitude && gf.radiusMeters) {
        const circle = L.circle([gf.centerLatitude, gf.centerLongitude], {
          radius: gf.radiusMeters,
          color: gf.color || '#2563eb',
          fillColor: gf.color || '#3b82f6',
          fillOpacity: 0.12,
          weight: 2,
        });
        circle.bindTooltip(`<b>${gf.name}</b><br/>شعاع: ${gf.radiusMeters} متر`, { sticky: true });
        geofenceLayersRef.current?.addLayer(circle);
      } else if (gf.type === GeofenceType.POLYGON && gf.coordinates && gf.coordinates.length >= 3) {
        const poly = L.polygon(gf.coordinates, {
          color: gf.color || '#7c3aed',
          fillColor: gf.color || '#8b5cf6',
          fillOpacity: 0.12,
          weight: 2,
        });
        poly.bindTooltip(`<b>${gf.name}</b> (محدوده چندضلعی)`, { sticky: true });
        geofenceLayersRef.current?.addLayer(poly);
      }
    });
  }, [geofences, showGeofences]);

  // Render Route History Polyline
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (routeHistory.length > 1) {
      const latLngs: L.LatLngExpression[] = routeHistory.map((p) => [p.latitude, p.longitude]);
      routePolylineRef.current = L.polyline(latLngs, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.85,
      }).addTo(map);

      map.fitBounds(routePolylineRef.current.getBounds(), { padding: [40, 40] });
    }
  }, [routeHistory]);

  // Handle Playback Marker in History Mode
  useEffect(() => {
    if (!mapInstanceRef.current || routeHistory.length === 0 || historyPlaybackIndex === undefined) {
      if (playbackMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(playbackMarkerRef.current);
        playbackMarkerRef.current = null;
      }
      return;
    }

    const map = mapInstanceRef.current;
    const point = routeHistory[historyPlaybackIndex];
    if (!point) return;

    const playbackHtml = `
      <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-blue-500/30" style="transform: rotate(${point.heading}deg)">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
        </svg>
      </div>
    `;

    const icon = L.divIcon({
      html: playbackHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    if (!playbackMarkerRef.current) {
      playbackMarkerRef.current = L.marker([point.latitude, point.longitude], { icon }).addTo(map);
    } else {
      playbackMarkerRef.current.setLatLng([point.latitude, point.longitude]);
      playbackMarkerRef.current.setIcon(icon);
    }
  }, [routeHistory, historyPlaybackIndex]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleCenterKabul = () => {
    mapInstanceRef.current?.setView([34.5368, 69.1724], 12);
  };

  const fitAllVehicles = () => {
    if (!mapInstanceRef.current || currentStates.length === 0) {
      handleCenterKabul();
      return;
    }
    const bounds = L.latLngBounds(currentStates.map((s) => [s.latitude, s.longitude]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  };

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-slate-200/80 bg-slate-100 shadow-xs ${className}`}>
      {/* Map Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map Controls Top-Left */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-2">
        {/* Layer Selector Button */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition shadow-sm flex items-center gap-1.5"
            title="تغییر لایه نقشه"
          >
            <Layers className="w-4 h-4" />
            <span className="text-xs font-semibold hidden md:inline">لایه‌های نقشه</span>
          </button>

          {/* Layer Selector Dropdown */}
          {showLayerMenu && (
            <div className="absolute top-full left-0 mt-1.5 w-64 bg-white rounded-xl border border-slate-200 shadow-xl p-2 space-y-1 z-50 text-right font-sans">
              <div className="text-[11px] font-bold text-slate-400 px-2 py-1 border-b border-slate-100">
                انتخاب لایه نقشه OpenStreetMap
              </div>
              {(Object.keys(TILE_CONFIGS) as MapTileTheme[]).map((key) => {
                const cfg = TILE_CONFIGS[key];
                const isSelected = mapTileLayer === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setMapTileLayer(key);
                      setShowLayerMenu(false);
                    }}
                    className={`w-full text-right p-2 rounded-lg text-xs transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{cfg.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{cfg.sub}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Fit All Vehicles Button */}
        <button
          onClick={fitAllVehicles}
          className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition shadow-sm"
          title="نمایش تمام وسایط نقلیه در نقشه"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Geofence Visibility Toggle */}
        <button
          onClick={() => setShowGeofences(!showGeofences)}
          className={`p-2.5 rounded-lg transition shadow-sm border ${
            showGeofences
              ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
          title="نمایش یا پنهان‌سازی محدوده‌ها (Geofences)"
        >
          <Shield className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Zoom & Compass Controls Top-Right */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded text-slate-700 hover:bg-slate-100 transition"
          title="بزرگنمایی"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded text-slate-700 hover:bg-slate-100 transition border-t border-slate-100"
          title="کوچکنمایی"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleCenterKabul}
          className="p-1.5 rounded text-slate-700 hover:bg-slate-100 transition border-t border-slate-100"
          title="مرکز نقشه (کابل)"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Status / Legend Badge Bottom-Right */}
      <div className="absolute bottom-3 right-3 z-[400] hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur px-3.5 py-2 rounded-lg border border-slate-200 text-xs shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-700 font-medium">حرکت</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-700 font-medium">درجا</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          <span className="text-slate-700 font-medium">پارک</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          <span className="text-slate-500 font-medium">آفلاین</span>
        </div>
      </div>

      {/* Empty State Banner if 0 active vehicles */}
      {vehicles.length === 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[400] bg-white/95 backdrop-blur px-4 py-2.5 rounded-xl border border-slate-200 shadow-md text-xs text-slate-700 flex items-center gap-2">
          <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
          <span>سامانه آماده دریافت دیتا &bull; درگاه‌های <strong>5001 TCP</strong> و <strong>5002 UDP</strong> فعال می‌باشند.</span>
        </div>
      )}
    </div>
  );
};

