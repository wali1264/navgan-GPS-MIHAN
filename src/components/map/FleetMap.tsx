/**
 * Full-Featured Interactive Leaflet Fleet Map
 * Powered by OpenStreetMap (OSM) and High-Resolution Free Tile Layers.
 * Features separate, robust layers for live fleet vehicles, route history polylines,
 * and animated playback marker with smooth heading alignment.
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
  const liveMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const geofenceLayersRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<L.LayerGroup | null>(null);
  const playbackMarkerRef = useRef<L.Marker | null>(null);

  const [mapTileLayer, setMapTileLayer] = useState<MapTileTheme>('osm_standard');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showGeofences, setShowGeofences] = useState(true);
  const [followSelected, setFollowSelected] = useState(true);

  // Map Tile Definitions (100% Free & Open Source OSM based)
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

  // Initialize Map and Layer Groups
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
    liveMarkersLayerRef.current = L.layerGroup().addTo(map);
    geofenceLayersRef.current = L.layerGroup().addTo(map);
    waypointMarkersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    // Trigger map invalidation to handle mobile and container mounting smoothly
    const invalidate = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      invalidate();
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    const t1 = setTimeout(invalidate, 50);
    const t2 = setTimeout(invalidate, 150);
    const t3 = setTimeout(invalidate, 350);
    const t4 = setTimeout(invalidate, 700);

    window.addEventListener('resize', invalidate);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener('resize', invalidate);
      resizeObserver.disconnect();
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

  // Render / Update Live Vehicle Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !liveMarkersLayerRef.current) return;
    const layer = liveMarkersLayerRef.current;

    // Clear previous live markers cleanly
    layer.clearLayers();

    const statesToDisplay =
      selectedVehicleId && selectedVehicleId !== 'all'
        ? currentStates.filter((s) => s.vehicleId === selectedVehicleId)
        : currentStates;

    // If we have live current states to show
    if (statesToDisplay.length > 0) {
      statesToDisplay.forEach((state) => {
        const vehicle = vehicles.find((v) => v.id === state.vehicleId);
        if (!vehicle) return;

        const isMoving = state.onlineStatus === VehicleStatus.MOVING;
        const isIdle = state.onlineStatus === VehicleStatus.IDLE;
        const isStopped = state.onlineStatus === VehicleStatus.STOPPED;
        const isOffline = state.onlineStatus === VehicleStatus.OFFLINE;

        const bgBadgeColor = isMoving
          ? 'bg-emerald-600 text-white shadow-md'
          : isIdle
          ? 'bg-amber-500 text-white shadow-md'
          : isStopped
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-slate-500 text-white shadow-sm';

        const isSelected = selectedVehicleId === state.vehicleId;
        const ringClass = isSelected
          ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-white scale-110'
          : isMoving
          ? 'ring-2 ring-emerald-400/60 ring-offset-1 ring-offset-white'
          : '';

        const customHtml = `
          <div class="relative flex flex-col items-center group cursor-pointer transition-transform">
            <div class="w-8 h-8 rounded-full ${bgBadgeColor} ${ringClass} flex items-center justify-center shadow-lg border-2 border-white transition-all duration-300" style="transform: rotate(${state.heading || 0}deg)">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
            <div class="absolute -bottom-5 bg-white text-[11px] font-bold text-slate-900 px-2 py-0.5 rounded shadow-md border border-slate-200 whitespace-nowrap pointer-events-none font-mono">
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

        const marker = L.marker([state.latitude, state.longitude], { icon: customIcon });
        marker.on('click', () => {
          if (onSelectVehicle) {
            onSelectVehicle(state.vehicleId);
          }
        });

        const statusText = isMoving
          ? `در حال حرکت (${state.speed} km/h)`
          : isIdle
          ? 'روشن و متوقف'
          : isStopped
          ? 'خاموش / متوقف'
          : 'آفلاین (بدون ارتباط)';

        const statusBadge = isMoving
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : isIdle
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : isStopped
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-slate-100 text-slate-600 border-slate-200';

        const batteryDisplay =
          isOffline
            ? 'قطع ارتباط'
            : state.batteryVoltage !== undefined
            ? `${state.batteryVoltage}V`
            : 'بدون سنسور';

        const signalDisplay = isOffline ? 'قطع' : `${state.gsmSignal || 0}%`;

        const popupHtml = `
          <div class="p-2.5 space-y-2 text-right dir-rtl font-sans min-w-[200px] bg-white rounded-lg">
            <div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span class="text-xs font-bold text-slate-900 font-mono">${vehicle.plateNumber}</span>
              <span class="text-[10px] px-2 py-0.5 rounded border font-medium ${statusBadge}">${statusText}</span>
            </div>
            <div class="text-xs font-semibold text-slate-700">${vehicle.vehicleName}</div>
            <div class="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
              <div>⚡ سرعت: <strong class="text-slate-900 font-mono">${state.speed}</strong> km/h</div>
              <div>📡 آنتن: <strong class="text-slate-900 font-mono">${signalDisplay}</strong></div>
              <div class="col-span-2">🔋 ولتاژ بطری: <strong class="text-slate-900 font-mono">${batteryDisplay}</strong></div>
            </div>
            <div class="text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
              <span>📍 ${state.address || 'افغانستان'}</span>
            </div>
          </div>
        `;
        marker.bindPopup(popupHtml);
        layer.addLayer(marker);
      });

      // Auto-focus selected vehicle or initial single vehicle view
      if (mapInstanceRef.current) {
        if (selectedVehicleId && followSelected) {
          const selectedState = currentStates.find((s) => s.vehicleId === selectedVehicleId);
          if (selectedState && selectedState.latitude && selectedState.longitude) {
            mapInstanceRef.current.panTo([selectedState.latitude, selectedState.longitude], { animate: true });
          }
        } else if (!selectedVehicleId && statesToDisplay.length === 1) {
          const singleState = statesToDisplay[0];
          if (singleState.latitude && singleState.longitude) {
            mapInstanceRef.current.setView([singleState.latitude, singleState.longitude], 14, { animate: false });
          }
        }
        mapInstanceRef.current.invalidateSize();
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

  // Render Route History Polyline (Clean without clutter markers)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (waypointMarkersRef.current) {
      waypointMarkersRef.current.clearLayers();
    }

    if (routeHistory.length > 1) {
      const latLngs: L.LatLngExpression[] = routeHistory.map((p) => [p.latitude, p.longitude]);
      routePolylineRef.current = L.polyline(latLngs, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.9,
      }).addTo(map);

      map.fitBounds(routePolylineRef.current.getBounds(), { padding: [40, 40] });
    }
  }, [routeHistory]);

  // Handle Animated Playback Marker in History Mode
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (routeHistory.length === 0 || historyPlaybackIndex === undefined) {
      if (playbackMarkerRef.current) {
        map.removeLayer(playbackMarkerRef.current);
        playbackMarkerRef.current = null;
      }
      return;
    }

    const point = routeHistory[historyPlaybackIndex];
    if (!point) return;

    const playbackHtml = `
      <div class="relative flex flex-col items-center group cursor-pointer scale-110">
        <div class="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl border-2 border-white ring-4 ring-blue-500/40 transition-transform duration-200" style="transform: rotate(${point.heading}deg)">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
        <div class="absolute -bottom-5 bg-blue-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow border border-white/50 whitespace-nowrap pointer-events-none font-mono">
          ${point.speed} km/h
        </div>
      </div>
    `;

    const icon = L.divIcon({
      html: playbackHtml,
      iconSize: [36, 42],
      iconAnchor: [18, 21],
    });

    if (!playbackMarkerRef.current) {
      playbackMarkerRef.current = L.marker([point.latitude, point.longitude], { icon, zIndexOffset: 1000 }).addTo(map);
    } else {
      playbackMarkerRef.current.setLatLng([point.latitude, point.longitude]);
      playbackMarkerRef.current.setIcon(icon);
    }

    map.panTo([point.latitude, point.longitude], { animate: true, duration: 0.3 });
  }, [routeHistory, historyPlaybackIndex]);

  // Zoom Controls
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  const handleCenterKabul = () => {
    mapInstanceRef.current?.setView([34.5368, 69.1724], 12, { animate: true });
  };

  return (
    <div className={`relative w-full h-full min-h-[350px] overflow-hidden ${className}`}>
      {/* Map DOM Canvas */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Floating Map Controls (Top Right) - Compact & Clean */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5">
        {/* Layer Switcher Button */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="p-2 rounded-lg bg-white/95 backdrop-blur text-slate-700 shadow-md hover:bg-white border border-slate-200 transition active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="تغییر لایه نقشه"
          >
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">لایه‌ها</span>
          </button>

          {/* Layer Menu Popup */}
          {showLayerMenu && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 space-y-1 text-right dir-rtl animate-in fade-in slide-in-from-top-2">
              <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                انتخاب لایه نقشه
              </div>
              {(Object.keys(TILE_CONFIGS) as MapTileTheme[]).map((key) => (
                <button
                  key={key}
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
                  <div className="space-y-0.5">
                    <div>{TILE_CONFIGS[key].label}</div>
                    <div className="text-[9px] text-slate-400 font-normal">{TILE_CONFIGS[key].sub}</div>
                  </div>
                  {mapTileLayer === key && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zoom In / Out Buttons */}
        <div className="flex flex-col bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-200 overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-slate-100 text-slate-700 border-b border-slate-100 transition cursor-pointer"
            title="بزرگ‌نمایی"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            title="کوچک‌نمایی"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
