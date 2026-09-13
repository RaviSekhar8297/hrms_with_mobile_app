'use client';

import React, { useEffect, useRef } from 'react';

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
}

export function LeafletMapComponent({ logs, employeeName }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Load Leaflet CSS dynamically if not present
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS script dynamically
    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      // Clear existing map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      if (!logs || logs.length === 0) return;

      const firstLog = logs[0];
      const map = L.map(mapContainerRef.current).setView([firstLog.latitude, firstLog.longitude], 14);
      mapInstanceRef.current = map;

      // OpenStreetMap Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Coordinates array for polyline route
      const polylineCoords: [number, number][] = [];

      logs.forEach((log, idx) => {
        const latLng: [number, number] = [log.latitude, log.longitude];
        polylineCoords.push(latLng);

        const isFirst = idx === 0;
        const isLast = idx === logs.length - 1;

        const timeStr = new Date(log.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

        // Custom marker colors: Green for Start, Blue for Route, Red for Latest
        const markerColor = isFirst ? '#10B981' : isLast ? '#EF4444' : '#3B82F6';

        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div style="background-color: ${markerColor}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const popupContent = `
          <div style="font-family: sans-serif; font-size: 11px; padding: 2px;">
            <strong>${employeeName}</strong> (${isFirst ? 'Start Punch' : isLast ? 'Latest Ping' : `Ping #${idx + 1}`})<br/>
            <span>Time: <b>${timeStr}</b></span><br/>
            <span>${log.location_name || `${log.latitude.toFixed(5)}, ${log.longitude.toFixed(5)}`}</span>
          </div>
        `;

        L.marker(latLng, { icon: customIcon }).addTo(map).bindPopup(popupContent);
      });

      // Draw Route Polyline
      if (polylineCoords.length > 1) {
        const polyline = L.polyline(polylineCoords, {
          color: '#4F46E5',
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 6'
        }).addTo(map);

        // Fit map bounds to show entire route
        map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
      }
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

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-80 rounded-xl overflow-hidden z-10"
      style={{ minHeight: '320px' }}
    />
  );
}

export default LeafletMapComponent;
