'use client';

import React, { useEffect } from 'react';
import { getHeaders } from '../utils/api';

export default function LiveLocationTracker() {
  useEffect(() => {
    // Only run on client-side browser with Geolocation support
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    const sendLocationPing = async () => {
      try {
        // Verify user logged in session
        const token = localStorage.getItem('access_token');
        if (!token) return;

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            let locationName: string | null = null;

            // Optional reverse geocoding via OpenStreetMap Nominatim API
            try {
              const geoRes = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
                { headers: { 'User-Agent': 'Brihaspathi-HRMS/1.0' } }
              );
              if (geoRes.ok) {
                const geoData = await geoRes.json();
                locationName = geoData.display_name || null;
              }
            } catch (e) {
              // Ignore geocoding errors silently
            }

            await fetch('/api/v1/attendance/live-location', {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({
                latitude,
                longitude,
                location_name: locationName
              })
            });
          },
          (err) => {
            // Geolocation error handled silently
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
      } catch (e) {
        // Silent catch
      }
    };

    // Initial ping on component mount
    sendLocationPing();

    // Repeat every 10 minutes (600,000 milliseconds)
    const intervalId = setInterval(sendLocationPing, 600000);

    return () => clearInterval(intervalId);
  }, []);

  return null; // Silent background component with 0 UI footprint
}
