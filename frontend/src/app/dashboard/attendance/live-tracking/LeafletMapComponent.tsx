'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, FastForward, MapPin, Navigation, Clock, Route, Compass, CheckCircle2 } from 'lucide-react';

interface LocationLog {
  id: string;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  recorded_at: string;
}

export interface LeafletMapProps {
  logs: LocationLog[];
  employeeName: string;
  selectedLogId?: string | null;
  onSelectLog?: (logId: string) => void;
}

export function LeafletMapComponent({ logs, employeeName, selectedLogId, onSelectLog }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const movingMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const polylineGlowRef = useRef<any>(null);
  const markerRefs = useRef<{ [key: number]: any }>({});
  const animationRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1); // 1x, 2x, 4x
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [activeLog, setActiveLog] = useState<LocationLog | null>(logs[0] || null);

  // Routing State
  const [useRoadSnapping, setUseRoadSnapping] = useState<boolean>(true);
  const [isFetchingRoute, setIsFetchingRoute] = useState<boolean>(false);
  const [roadRouteCoords, setRoadRouteCoords] = useState<[number, number][]>([]);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number | null>(null);

  // Direct P2P coordinates as fallback
  const directCoords: [number, number][] = logs.map((l) => [l.latitude, l.longitude]);

  // Sync active log when currentIndex changes
  useEffect(() => {
    if (logs && logs[currentIndex]) {
      setActiveLog(logs[currentIndex]);
      if (onSelectLog && logs[currentIndex].id) {
        onSelectLog(logs[currentIndex].id);
      }
    }
  }, [currentIndex, logs, onSelectLog]);

  // Sync with external selectedLogId if user clicks log item in list
  useEffect(() => {
    if (!selectedLogId || !logs.length) return;
    const idx = logs.findIndex((l) => l.id === selectedLogId);
    if (idx !== -1 && idx !== currentIndex) {
      setCurrentIndex(idx);
      setIsPlaying(false);
    }
  }, [selectedLogId, logs]);

  // Fetch OSRM Road Routing
  useEffect(() => {
    if (!logs || logs.length < 2) {
      setRoadRouteCoords([]);
      setTotalDistanceKm(null);
      return;
    }

    let isMounted = true;
    const fetchOSRMRoute = async () => {
      setIsFetchingRoute(true);
      try {
        // Build OSRM waypoint query string (longitude,latitude;longitude,latitude;...)
        const coordString = logs.map((l) => `${l.longitude},${l.latitude}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM HTTP error status: ${res.status}`);

        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          // OSRM returns GeoJSON coordinates: [longitude, latitude] -> convert to Leaflet [latitude, longitude]
          const mappedCoords: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );

          if (isMounted) {
            setRoadRouteCoords(mappedCoords);
            setTotalDistanceKm(Number((route.distance / 1000).toFixed(2)));
          }
        } else {
          throw new Error('OSRM routing returned non-Ok code');
        }
      } catch (err) {
        console.warn('OSRM road routing fallback to direct lines:', err);
        if (isMounted) {
          setRoadRouteCoords([]);
          setTotalDistanceKm(null);
        }
      } finally {
        if (isMounted) setIsFetchingRoute(false);
      }
    };

    fetchOSRMRoute();

    return () => {
      isMounted = false;
    };
  }, [logs]);

  // Initialize and Update Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Inject Leaflet CSS if missing
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Inject animation styles if missing
    if (!document.getElementById('leaflet-custom-styles')) {
      const style = document.createElement('style');
      style.id = 'leaflet-custom-styles';
      style.innerHTML = `
        @keyframes pingPulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(1.6); opacity: 0.25; }
          100% { transform: scale(0.8); opacity: 0.8; }
        }
        @keyframes activeMarkerGlow {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        .leaflet-active-ping {
          animation: activeMarkerGlow 2s infinite;
          z-index: 999 !important;
        }
      `;
      document.head.appendChild(style);
    }

    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      // Clean up previous map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      if (!logs || logs.length === 0) return;

      const firstLog = logs[0];
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([firstLog.latitude, firstLog.longitude], 15);

      mapInstanceRef.current = map;

      // CartoDB Voyager Tile Layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      // Recalculate bounds after modal transition
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);

      markerRefs.current = {};

      // Render Numbered Markers for each ping
      logs.forEach((log, idx) => {
        const latLng: [number, number] = [log.latitude, log.longitude];
        const isFirst = idx === 0;
        const isLast = idx === logs.length - 1;

        const timeStr = new Date(log.recorded_at).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        // Color coding: Start (Green), Last (Red), Intermediate (Blue)
        const bgGradient = isFirst
          ? 'linear-gradient(135deg, #10B981, #059669)'
          : isLast
          ? 'linear-gradient(135deg, #EF4444, #DC2626)'
          : 'linear-gradient(135deg, #2563EB, #1D4ED8)';

        const pinHtml = `
          <div style="
            position: relative;
            background: ${bgGradient};
            color: white;
            min-width: 26px;
            height: 26px;
            padding: 0 6px;
            border-radius: 9999px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 900;
            border: 2px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: system-ui, -apple-system, sans-serif;
            letter-spacing: -0.5px;
          ">
            <span>${idx + 1}</span>
            ${isFirst ? '<span style="font-size: 8px; margin-left: 2px; text-transform: uppercase;">START</span>' : ''}
            ${isLast ? '<span style="font-size: 8px; margin-left: 2px; text-transform: uppercase;">END</span>' : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          className: `leaflet-ping-icon ${idx === currentIndex ? 'leaflet-active-ping' : ''}`,
          html: pinHtml,
          iconSize: [isFirst || isLast ? 58 : 28, 28],
          iconAnchor: [isFirst || isLast ? 29 : 14, 14]
        });

        const popupHtml = `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 6px; min-width: 170px;">
            <div style="font-weight: 900; font-size: 12px; color: #0f172a; margin-bottom: 2px;">
              ${employeeName}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #475569; font-weight: 700; margin-bottom: 4px;">
              <span>${isFirst ? '🟢 Start Punch (#1)' : isLast ? `🔴 Final Ping (#${idx + 1})` : `📍 Ping #${idx + 1}`}</span>
              <span style="color: #2563eb; font-weight: 800;">${timeStr}</span>
            </div>
            <div style="font-size: 10.5px; color: #334155; line-height: 1.35; font-weight: 600; background: #f8fafc; padding: 6px 8px; border-radius: 8px; border: 1px solid #e2e8f0;">
              ${log.location_name || `${log.latitude.toFixed(6)}, ${log.longitude.toFixed(6)}`}
            </div>
          </div>
        `;

        const marker = L.marker(latLng, { icon: customIcon }).addTo(map).bindPopup(popupHtml);
        markerRefs.current[idx] = marker;

        marker.on('click', () => {
          setCurrentIndex(idx);
          setIsPlaying(false);
        });
      });

      // Select active polyline coords: Road Route if available & enabled, else Direct
      const activeCoords =
        useRoadSnapping && roadRouteCoords.length > 0 ? roadRouteCoords : directCoords;

      if (activeCoords.length > 1) {
        // Glowing Background Polyline
        polylineGlowRef.current = L.polyline(activeCoords, {
          color: '#6366F1',
          weight: 7,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Foreground Polyline
        polylineRef.current = L.polyline(activeCoords, {
          color: useRoadSnapping && roadRouteCoords.length > 0 ? '#2563EB' : '#4F46E5',
          weight: 4,
          opacity: 0.9,
          dashArray: useRoadSnapping && roadRouteCoords.length > 0 ? undefined : '8, 8',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        map.fitBounds(polylineRef.current.getBounds(), { padding: [45, 45] });
      }

      // Animated Moving Tracker Avatar
      const initialPos = activeCoords[0] || [firstLog.latitude, firstLog.longitude];
      const movingHtml = `
        <div style="position: relative; width: 38px; height: 38px;">
          <div style="
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: rgba(37, 99, 235, 0.4);
            animation: pingPulse 1.8s infinite ease-in-out;
          "></div>
          <div style="
            position: absolute;
            inset: 3px;
            background: linear-gradient(135deg, #1d4ed8, #7c3aed);
            border: 2.5px solid white;
            border-radius: 50%;
            box-shadow: 0 6px 18px rgba(37, 99, 235, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          ">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          </div>
        </div>
      `;

      const movingIcon = L.divIcon({
        className: 'moving-tracker-marker',
        html: movingHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      movingMarkerRef.current = L.marker(initialPos, { icon: movingIcon, zIndexOffset: 1000 }).addTo(map);
    };

    if ((window as any).L) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      document.body.appendChild(script);
    }
  }, [logs, employeeName, useRoadSnapping, roadRouteCoords]);

  // Update moving marker position when currentIndex changes
  useEffect(() => {
    if (!logs || logs.length === 0 || !movingMarkerRef.current || !mapInstanceRef.current) return;
    const currentLog = logs[currentIndex];
    if (currentLog) {
      const latLng: [number, number] = [currentLog.latitude, currentLog.longitude];
      movingMarkerRef.current.setLatLng(latLng);
      mapInstanceRef.current.panTo(latLng, { animate: true, duration: 0.5 });
    }
  }, [currentIndex, logs]);

  // Animated Playback Loop across pings
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    if (currentIndex >= logs.length - 1) {
      setIsPlaying(false);
      return;
    }

    let startTimestamp: number | null = null;
    const fromLog = logs[currentIndex];
    const toLog = logs[currentIndex + 1];

    // Determine sub-path for segment if road route is active
    let segmentCoords: [number, number][] = [];
    if (useRoadSnapping && roadRouteCoords.length > 0) {
      // Find nearest indices in roadRouteCoords to fromLog and toLog
      let fromIdx = 0;
      let toIdx = roadRouteCoords.length - 1;
      let minFromDist = Infinity;
      let minToDist = Infinity;

      roadRouteCoords.forEach((pt, idx) => {
        const dFrom = Math.hypot(pt[0] - fromLog.latitude, pt[1] - fromLog.longitude);
        const dTo = Math.hypot(pt[0] - toLog.latitude, pt[1] - toLog.longitude);
        if (dFrom < minFromDist) {
          minFromDist = dFrom;
          fromIdx = idx;
        }
        if (dTo < minToDist) {
          minToDist = dTo;
          toIdx = idx;
        }
      });

      if (fromIdx <= toIdx) {
        segmentCoords = roadRouteCoords.slice(fromIdx, toIdx + 1);
      } else {
        segmentCoords = roadRouteCoords.slice(toIdx, fromIdx + 1).reverse();
      }
    }

    if (segmentCoords.length < 2) {
      segmentCoords = [
        [fromLog.latitude, fromLog.longitude],
        [toLog.latitude, toLog.longitude]
      ];
    }

    // Step duration based on speed multiplier
    const stepDuration = 1600 / speed;

    const animateSegment = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / stepDuration, 1);

      // Interpolate along segmentCoords
      const totalPoints = segmentCoords.length;
      const pointProgress = progress * (totalPoints - 1);
      const baseIdx = Math.floor(pointProgress);
      const subRatio = pointProgress - baseIdx;

      const p1 = segmentCoords[Math.min(baseIdx, totalPoints - 1)];
      const p2 = segmentCoords[Math.min(baseIdx + 1, totalPoints - 1)];

      const lat = p1[0] + (p2[0] - p1[0]) * subRatio;
      const lng = p1[1] + (p2[1] - p1[1]) * subRatio;

      if (movingMarkerRef.current) {
        movingMarkerRef.current.setLatLng([lat, lng]);
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateSegment);
      } else {
        if (currentIndex + 1 < logs.length) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          setIsPlaying(false);
        }
      }
    };

    animationRef.current = requestAnimationFrame(animateSegment);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentIndex, speed, logs, useRoadSnapping, roadRouteCoords]);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleSpeedToggle = () => {
    setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1));
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-[390px] md:h-[440px] z-10" />

      {/* Floating Dynamic Header with Location & Route Info */}
      {activeLog && (
        <div className="absolute top-3 left-3 right-3 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
              {currentIndex + 1}
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 dark:text-white truncate text-xs">
                  {activeLog.location_name || `${activeLog.latitude.toFixed(5)}, ${activeLog.longitude.toFixed(5)}`}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  Ping #{currentIndex + 1} of {logs.length}
                </span>
              </div>
              <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>
                  Recorded at{' '}
                  <strong className="text-slate-700 dark:text-slate-200 font-bold">
                    {new Date(activeLog.recorded_at).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </strong>
                </span>
              </p>
            </div>
          </div>

          {/* Route distance & Snapping toggle badge */}
          <div className="flex items-center gap-2 shrink-0">
            {totalDistanceKm !== null && useRoadSnapping && (
              <div className="flex items-center gap-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <Route className="w-3.5 h-3.5 text-emerald-600" />
                <span>{totalDistanceKm} KM Road Route</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setUseRoadSnapping(!useRoadSnapping)}
              title="Toggle between Road Routing (OSRM) and Direct Lines"
              className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                useRoadSnapping
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{useRoadSnapping ? 'Road Snap: ON' : 'Direct Lines'}</span>
              {isFetchingRoute && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping ml-1" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Toolbar */}
      <div className="absolute bottom-3 left-3 right-3 z-[400] bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-700/60 shadow-xl flex flex-wrap items-center justify-between gap-3 text-white">
        {/* Play/Pause & Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-xs font-black text-white shadow-md cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Movement</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Live Route</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            title="Reset to start"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-300 hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleSpeedToggle}
            title="Toggle playback speed"
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-xs font-extrabold text-blue-400 cursor-pointer flex items-center gap-1"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{speed}x</span>
          </button>
        </div>

        {/* Timeline Slider */}
        <div className="flex-1 min-w-[180px] flex items-center gap-3">
          <span className="text-[11px] font-black text-slate-400 shrink-0">
            {currentIndex + 1} / {logs.length}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(logs.length - 1, 0)}
            value={currentIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(Number(e.target.value));
            }}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-xl">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Numbered Waypoints Active</span>
        </div>
      </div>
    </div>
  );
}

export default LeafletMapComponent;
