'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Maximize2 } from 'lucide-react';

interface LocationLog {
  id: string;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  recorded_at: string;
  emp_image?: string | null;
}

export interface LeafletMapProps {
  logs: LocationLog[];
  employeeName: string;
  empImage?: string | null;
  selectedLogId?: string | null;
  onSelectLog?: (logId: string) => void;
}

const getFormattedAvatarUrl = (raw?: string | null): string | null => {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/9j/') || trimmed.startsWith('/9j4')) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  if (trimmed.startsWith('iVBORw')) {
    return `data:image/png;base64,${trimmed}`;
  }
  if (trimmed.startsWith('R0lGOD')) {
    return `data:image/gif;base64,${trimmed}`;
  }
  if (trimmed.startsWith('PHN2Zw')) {
    return `data:image/svg+xml;base64,${trimmed}`;
  }
  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }
  if (trimmed.startsWith('uploads/')) {
    return `/${trimmed}`;
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/uploads/${trimmed}`;
};

export function LeafletMapComponent({ logs, employeeName, empImage, selectedLogId, onSelectLog }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const movingMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const polylineGlowRef = useRef<any>(null);
  const markerRefs = useRef<{ [key: number]: any }>({});
  const animationRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Routing State
  const [roadRouteCoords, setRoadRouteCoords] = useState<[number, number][]>([]);

  const directCoords: [number, number][] = logs.map((l) => [l.latitude, l.longitude]);

  useEffect(() => {
    if (logs && logs[currentIndex]) {
      if (onSelectLog && logs[currentIndex].id) {
        onSelectLog(logs[currentIndex].id);
      }
    }
  }, [currentIndex, logs, onSelectLog]);

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
      return;
    }

    let isMounted = true;
    const fetchOSRMRoute = async () => {
      try {
        const coordString = logs.map((l) => `${l.longitude},${l.latitude}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM HTTP error status: ${res.status}`);

        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const mappedCoords: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );

          if (isMounted) {
            setRoadRouteCoords(mappedCoords);
          }
        }
      } catch (err) {
        if (isMounted) {
          setRoadRouteCoords([]);
        }
      }
    };

    fetchOSRMRoute();

    return () => {
      isMounted = false;
    };
  }, [logs]);

  // Function to re-fit route on map
  const fitRouteBounds = () => {
    if (mapInstanceRef.current && polylineRef.current) {
      mapInstanceRef.current.fitBounds(polylineRef.current.getBounds(), {
        padding: [50, 50],
        maxZoom: 17,
        animate: true
      });
    }
  };

  // Initialize and Update Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-custom-styles')) {
      const style = document.createElement('style');
      style.id = 'leaflet-custom-styles';
      style.innerHTML = `
        @keyframes avatarPingPulse {
          0% { transform: scale(0.9); opacity: 0.85; }
          50% { transform: scale(1.6); opacity: 0.15; }
          100% { transform: scale(0.9); opacity: 0.85; }
        }
        @keyframes activeMarkerGlow {
          0% { box-shadow: 0 0 0 0 rgba(7, 81, 138, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(7, 81, 138, 0); }
          100% { box-shadow: 0 0 0 0 rgba(7, 81, 138, 0); }
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

      // Standard OpenStreetMap tiles (Free, no API key required, crisp view)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Invalidate sizes multiple times to guarantee zero grey tiles
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 300);
      setTimeout(() => map.invalidateSize(), 600);

      // Listen to resize events for seamless mobile viewports and layout switching
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        const ro = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        ro.observe(mapContainerRef.current);
      }

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

        const bgGradient = isFirst
          ? 'linear-gradient(135deg, #10B981, #059669)'
          : isLast
          ? 'linear-gradient(135deg, #EF4444, #DC2626)'
          : 'linear-gradient(135deg, #07518a, #064270)';

        const pinHtml = `
          <div style="
            position: relative;
            background: ${bgGradient};
            color: white;
            min-width: 24px;
            height: 24px;
            padding: 0 ${isFirst || isLast ? '6px' : '3px'};
            border-radius: 9999px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 900;
            border: 2px solid white;
            box-shadow: 0 4px 14px rgba(7,81,138,0.35);
            font-family: system-ui, -apple-system, sans-serif;
          ">
            <span>${idx + 1}</span>
            ${isFirst ? '<span style="font-size: 8px; margin-left: 3px; font-weight: 800; letter-spacing: 0.5px;">START</span>' : ''}
            ${isLast ? '<span style="font-size: 8px; margin-left: 3px; font-weight: 800; letter-spacing: 0.5px;">END</span>' : ''}
          </div>
        `;

        const customIcon = L.divIcon({
          className: `leaflet-ping-icon ${idx === currentIndex ? 'leaflet-active-ping' : ''}`,
          html: pinHtml,
          iconSize: [isFirst || isLast ? 58 : 26, 26],
          iconAnchor: [isFirst || isLast ? 29 : 13, 13]
        });

        const popupHtml = `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 6px; min-width: 170px;">
            <div style="font-weight: 900; font-size: 12px; color: #07518a; margin-bottom: 2px;">
              ${employeeName}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #475569; font-weight: 700; margin-bottom: 4px;">
              <span>${isFirst ? '🟢 Start Location' : isLast ? '🔴 Final Location' : `📍 Ping #${idx + 1}`}</span>
              <span style="color: #07518a; font-weight: 800;">${timeStr}</span>
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

      const activeCoords = roadRouteCoords.length > 0 ? roadRouteCoords : directCoords;

      if (activeCoords.length > 1) {
        // Subtle blue neon glow under route
        polylineGlowRef.current = L.polyline(activeCoords, {
          color: '#38bdf8',
          weight: 7,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Sharp primary route line using user's brand color #07518a
        polylineRef.current = L.polyline(activeCoords, {
          color: '#07518a',
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        map.fitBounds(polylineRef.current.getBounds(), { padding: [45, 45] });
      }

      // 2 & 4. Animated Employee Circular Avatar Marker (Moving on Play Route)
      const initialPos = activeCoords[0] || [firstLog.latitude, firstLog.longitude];
      const rawAvatarSrc = empImage || firstLog.emp_image || null;
      const avatarSrc = getFormattedAvatarUrl(rawAvatarSrc);
      const initialLetter = employeeName.charAt(0).toUpperCase();

      const movingHtml = `
        <div style="position: relative; width: 46px; height: 46px;">
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            background: rgba(7, 81, 138, 0.45);
            animation: avatarPingPulse 1.8s infinite ease-in-out;
          "></div>
          <div style="
            position: absolute;
            inset: 0;
            background: white;
            border: 3px solid #07518a;
            border-radius: 50%;
            box-shadow: 0 6px 18px rgba(7,81,138,0.4);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${avatarSrc ? `
              <img src="${avatarSrc}" alt="${employeeName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" onError="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div style="display: none; width: 100%; height: 100%; background: linear-gradient(135deg, #07518a, #0c63a5); color: white; font-weight: 900; font-size: 17px; align-items: center; justify-content: center; font-family: system-ui, sans-serif;">${initialLetter}</div>
            ` : `
              <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #07518a, #0c63a5); color: white; font-weight: 900; font-size: 17px; display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif;">${initialLetter}</div>
            `}
          </div>
        </div>
      `;

      const movingIcon = L.divIcon({
        className: 'moving-avatar-marker',
        html: movingHtml,
        iconSize: [46, 46],
        iconAnchor: [23, 23]
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
  }, [logs, employeeName, empImage, roadRouteCoords]);

  // Update moving marker position and highlight active pin marker when currentIndex changes
  useEffect(() => {
    if (!logs || logs.length === 0) return;

    // Highlight the active pin marker on the map
    Object.entries(markerRefs.current).forEach(([idxStr, marker]) => {
      const idx = Number(idxStr);
      const el = marker?.getElement?.();
      if (el) {
        if (idx === currentIndex) {
          el.classList.add('leaflet-active-ping');
        } else {
          el.classList.remove('leaflet-active-ping');
        }
      }
    });

    const currentLog = logs[currentIndex];
    if (currentLog && movingMarkerRef.current && mapInstanceRef.current) {
      const latLng: [number, number] = [currentLog.latitude, currentLog.longitude];
      if (!isPlaying) {
        movingMarkerRef.current.setLatLng(latLng);
        mapInstanceRef.current.panTo(latLng, { animate: true, duration: 0.5 });
      }
    }
  }, [currentIndex, logs, isPlaying]);

  // Animated Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    if (currentIndex >= logs.length - 1) {
      const resetTimer = setTimeout(() => {
        setIsPlaying(false);
        setCurrentIndex(0);
      }, 800);
      return () => {
        clearTimeout(resetTimer);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }

    let startTimestamp: number | null = null;
    const fromLog = logs[currentIndex];
    const toLog = logs[currentIndex + 1];

    let segmentCoords: [number, number][] = [];
    if (roadRouteCoords.length > 0) {
      let fromIdx = -1;
      let toIdx = -1;
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

      if (fromIdx !== -1 && toIdx !== -1) {
        if (fromIdx < toIdx) {
          segmentCoords = roadRouteCoords.slice(fromIdx, toIdx + 1);
        } else if (fromIdx > toIdx) {
          segmentCoords = roadRouteCoords.slice(toIdx, fromIdx + 1).reverse();
        } else {
          // If fromIdx === toIdx (duplicate coordinates or snapped to same road point)
          const totalLogs = logs.length;
          const approxStart = Math.floor((currentIndex / (totalLogs - 1)) * (roadRouteCoords.length - 1));
          const approxEnd = Math.floor(((currentIndex + 1) / (totalLogs - 1)) * (roadRouteCoords.length - 1));
          if (approxStart < approxEnd) {
            segmentCoords = roadRouteCoords.slice(approxStart, approxEnd + 1);
          }
        }
      }
    }

    if (segmentCoords.length < 2) {
      segmentCoords = [
        [fromLog.latitude, fromLog.longitude],
        [toLog.latitude, toLog.longitude]
      ];
    }

    // Steady 1 second (1000ms) transition from point to point at 1x speed
    const stepDuration = 1000 / speed;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([toLog.latitude, toLog.longitude], {
        animate: true,
        duration: stepDuration / 1000,
        easeLinearity: 0.25
      });
    }

    const animateSegment = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / stepDuration, 1);

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
  }, [isPlaying, currentIndex, speed, logs, roadRouteCoords]);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleSpeedToggle = () => {
    setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1));
  };

  return (
    <div className="relative w-full h-full flex-1 flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Map Container - Expands 100% */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 min-h-[200px] md:min-h-[360px] z-10" />

      {/* Sleek Low-Height Floating Bottom Toolbar */}
      <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 z-[400] bg-slate-950/90 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-800/90 shadow-2xl flex flex-wrap items-center justify-between gap-2 text-white text-xs">
        {/* Play/Pause, Reset, Speed, and Fit */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (!isPlaying && currentIndex >= logs.length - 1) {
                setCurrentIndex(0);
              }
              setIsPlaying(!isPlaying);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#07518a] hover:bg-[#064270] active:scale-95 transition-all text-xs font-bold text-white shadow-md shadow-[#07518a]/30 cursor-pointer border-0"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Route</span>
              </>
            )}
          </button>


          <button
            type="button"
            onClick={handleSpeedToggle}
            title="Toggle playback speed"
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-[11px] font-bold text-[#38bdf8] transition-all cursor-pointer border border-slate-700/60"
          >
            {speed}x
          </button>

          <button
            type="button"
            onClick={fitRouteBounds}
            title="Fit entire route on map"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-[11px] font-bold text-slate-200 hover:text-white transition-all cursor-pointer border border-slate-700/60"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Fit Route</span>
          </button>
        </div>

        {/* Timeline Slider */}
        <div className="flex-1 min-w-[160px] flex items-center gap-2.5">
          <span className="text-[11px] font-extrabold text-[#38bdf8] shrink-0 font-mono">
            Ping {currentIndex + 1} / {logs.length}
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
            className="w-full h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-[#07518a]"
          />
        </div>
      </div>
    </div>
  );
}

export default LeafletMapComponent;
