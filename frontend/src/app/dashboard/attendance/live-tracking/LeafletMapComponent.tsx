'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, FastForward, MapPin, Navigation, Clock } from 'lucide-react';

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
  const animationRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1); // 1x, 2x, 4x
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [activeLog, setActiveLog] = useState<LocationLog | null>(logs[0] || null);

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

      // Modern Tile Layer (CartoDB Positron / OpenStreetMap fallback)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      // Force Leaflet to recalculate bounds after render (fixes modal size glitch)
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 200);

      const polylineCoords: [number, number][] = [];

      // Add markers for each ping
      logs.forEach((log, idx) => {
        const latLng: [number, number] = [log.latitude, log.longitude];
        polylineCoords.push(latLng);

        const isFirst = idx === 0;
        const isLast = idx === logs.length - 1;

        const timeStr = new Date(log.recorded_at).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        // Custom Pin Badges
        const bgGradient = isFirst
          ? 'linear-gradient(135deg, #10B981, #059669)'
          : isLast
          ? 'linear-gradient(135deg, #EF4444, #DC2626)'
          : 'linear-gradient(135deg, #3B82F6, #1D4ED8)';

        const pinHtml = `
          <div style="
            background: ${bgGradient};
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 800;
            border: 2px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            font-family: sans-serif;
          ">
            ${idx + 1}
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'leaflet-ping-icon',
          html: pinHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const popupHtml = `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 6px; min-width: 160px;">
            <div style="font-weight: 800; font-size: 12px; color: #1e293b; margin-bottom: 2px;">
              ${employeeName}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #64748b; font-weight: 700; margin-bottom: 4px;">
              <span>${isFirst ? '🟢 Start Punch' : isLast ? '🔴 Latest Ping' : `📍 Ping #${idx + 1}`}</span>
              <span style="color: #2563eb;">${timeStr}</span>
            </div>
            <div style="font-size: 10.5px; color: #334155; line-height: 1.3; font-weight: 500; background: #f8fafc; padding: 4px 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
              ${log.location_name || `${log.latitude.toFixed(5)}, ${log.longitude.toFixed(5)}`}
            </div>
          </div>
        `;

        const marker = L.marker(latLng, { icon: customIcon }).addTo(map).bindPopup(popupHtml);

        marker.on('click', () => {
          setCurrentIndex(idx);
          setIsPlaying(false);
        });
      });

      // Draw Polyline path
      if (polylineCoords.length > 1) {
        // Glowing back line
        L.polyline(polylineCoords, {
          color: '#6366F1',
          weight: 6,
          opacity: 0.3
        }).addTo(map);

        // Dashed top line
        const polyline = L.polyline(polylineCoords, {
          color: '#4F46E5',
          weight: 3.5,
          opacity: 0.9,
          dashArray: '8, 8'
        }).addTo(map);

        map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      }

      // Moving Tracking Avatar Marker
      const initialPos = polylineCoords[0];
      const movingHtml = `
        <div style="position: relative; width: 36px; height: 36px;">
          <div style="
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: rgba(99, 102, 241, 0.4);
            animation: pingPulse 1.8s infinite ease-in-out;
          "></div>
          <div style="
            position: absolute;
            inset: 3px;
            background: linear-gradient(135deg, #4f46e5, #9333ea);
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 4px 14px rgba(79, 70, 229, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          </div>
        </div>
      `;

      // Inject keyframes animation style into head if missing
      if (!document.getElementById('leaflet-ping-style')) {
        const style = document.createElement('style');
        style.id = 'leaflet-ping-style';
        style.innerHTML = `
          @keyframes pingPulse {
            0% { transform: scale(0.8); opacity: 0.8; }
            50% { transform: scale(1.5); opacity: 0.3; }
            100% { transform: scale(0.8); opacity: 0.8; }
          }
        `;
        document.head.appendChild(style);
      }

      const movingIcon = L.divIcon({
        className: 'moving-tracker-marker',
        html: movingHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
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
  }, [logs, employeeName]);

  // Update moving marker position when currentIndex changes
  useEffect(() => {
    if (!logs || logs.length === 0 || !movingMarkerRef.current || !mapInstanceRef.current) return;
    const currentLog = logs[currentIndex];
    if (currentLog) {
      const latLng: [number, number] = [currentLog.latitude, currentLog.longitude];
      movingMarkerRef.current.setLatLng(latLng);
      mapInstanceRef.current.panTo(latLng, { animate: true, duration: 0.6 });
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
      // Loop or Stop at end
      setIsPlaying(false);
      return;
    }

    let startTimestamp: number | null = null;
    const fromLog = logs[currentIndex];
    const toLog = logs[currentIndex + 1];

    // Duration based on speed multiplier (e.g. 1500ms / speed)
    const stepDuration = 1500 / speed;

    const animateSegment = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / stepDuration, 1);

      const lat = fromLog.latitude + (toLog.latitude - fromLog.latitude) * progress;
      const lng = fromLog.longitude + (toLog.longitude - fromLog.longitude) * progress;

      if (movingMarkerRef.current) {
        movingMarkerRef.current.setLatLng([lat, lng]);
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animateSegment);
      } else {
        // Move to next index
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
  }, [isPlaying, currentIndex, speed, logs]);

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
      <div
        ref={mapContainerRef}
        className="w-full h-[380px] md:h-[430px] z-10"
      />

      {/* Floating Dynamic Location Overlay Header */}
      {activeLog && (
        <div className="absolute top-3 left-3 right-3 z-[400] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {currentIndex + 1}
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 dark:text-white truncate">
                  {activeLog.location_name || `${activeLog.latitude.toFixed(5)}, ${activeLog.longitude.toFixed(5)}`}
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  Ping #{currentIndex + 1} of {logs.length}
                </span>
              </div>
              <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>
                  Recorded at{' '}
                  <strong className="text-slate-700 dark:text-slate-200 font-semibold">
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

          <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg shrink-0">
            <Navigation className="w-3.5 h-3.5 text-blue-500" />
            <span>
              {activeLog.latitude.toFixed(5)}, {activeLog.longitude.toFixed(5)}
            </span>
          </div>
        </div>
      )}

      {/* Floating Bottom Live Movement Controls Toolbar */}
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
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Interactive Breadcrumbs</span>
        </div>
      </div>
    </div>
  );
}

export default LeafletMapComponent;
