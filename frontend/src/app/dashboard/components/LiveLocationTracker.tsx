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

        // Verify employee is currently Punched IN today
        const todayStr = new Date().toISOString().split('T')[0];
        const punchRes = await fetch(`/api/v1/attendance/punches?start_date=${todayStr}&end_date=${todayStr}&scope=SELF`, {
          headers: getHeaders()
        });
        if (!punchRes.ok) return;
        const punchData = await punchRes.json();
        const punchesList = Array.isArray(punchData?.data) ? punchData.data : Array.isArray(punchData?.punches) ? punchData.punches : [];
        if (punchesList.length === 0) return; // No punch today
        const lastPunch = punchesList[0];
        const isIN = lastPunch.direction === 'IN' || lastPunch.punch_type === 'IN';
        if (!isIN) return; // Punched OUT or Not Punched IN today

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

    let intervalMs = 15 * 60 * 1000; // Default 15 minutes
    let timerId: any = null;

    const initTracker = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const res = await fetch('/api/v1/attendance/policies', { headers: getHeaders() });
          if (res.ok) {
            const data = await res.json();
            const policyMins = data?.policy?.location_tracking_interval_mins;
            if (policyMins && Number(policyMins) > 0) {
              intervalMs = Number(policyMins) * 60 * 1000;
            }
          }
        }
      } catch (e) {}

      // Initial ping on component mount
      sendLocationPing();

      // Dynamic repeat interval (default 15 minutes)
      timerId = setInterval(sendLocationPing, intervalMs);
    };

    initTracker();

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, []);

  return null; // Silent background component with 0 UI footprint
}
