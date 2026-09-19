'use client';

interface LocationLog {
  id?: string;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  recorded_at: string;
  emp_image?: string | null;
}

interface GenerateVideoParams {
  employeeName: string;
  date: string;
  logs: LocationLog[];
  roadRouteCoords?: [number, number][];
  empImage?: string | null;
  onProgress?: (progress: number) => void;
}

// Convert lat/lng to world pixel coordinates at a given zoom level (Web Mercator)
function latLngToWorld(lat: number, lng: number, zoom: number) {
  const sinY = Math.sin((lat * Math.PI) / 180);
  const clampedSinY = Math.min(Math.max(sinY, -0.9999), 0.9999);
  return {
    x: 256 * (0.5 + lng / 360) * Math.pow(2, zoom),
    y: 256 * (0.5 - Math.log((1 + clampedSinY) / (1 - clampedSinY)) / (4 * Math.PI)) * Math.pow(2, zoom)
  };
}

export async function generateRouteVideoClip({
  employeeName,
  date,
  logs,
  roadRouteCoords = [],
  empImage,
  onProgress
}: GenerateVideoParams): Promise<void> {
  if (!logs || logs.length === 0) {
    throw new Error('No tracking logs available to generate clip');
  }

  // Fallback check for browser support
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    throw new Error('Video recording is not supported in this browser environment');
  }

  const canvasWidth = 720;
  const canvasHeight = 720;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // 1. Determine bounding box and optimal zoom level
  const allPoints: [number, number][] =
    roadRouteCoords.length > 0 ? roadRouteCoords : logs.map((l) => [l.latitude, l.longitude]);

  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;

  allPoints.forEach(([lat, lng]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // Determine optimal zoom so the whole route fits comfortably within ~500px of canvas
  let zoom = 15;
  for (let z = 18; z >= 11; z--) {
    const pMin = latLngToWorld(minLat, minLng, z);
    const pMax = latLngToWorld(maxLat, maxLng, z);
    const spanX = Math.abs(pMax.x - pMin.x);
    const spanY = Math.abs(pMax.y - pMin.y);
    if (spanX <= canvasWidth - 160 && spanY <= canvasHeight - 200) {
      zoom = z;
      break;
    }
  }

  const centerWorld = latLngToWorld(centerLat, centerLng, zoom);

  // Function to project lat/lng to canvas coordinates
  const project = (lat: number, lng: number) => {
    const w = latLngToWorld(lat, lng, zoom);
    return {
      x: canvasWidth / 2 + (w.x - centerWorld.x),
      y: canvasHeight / 2 + (w.y - centerWorld.y)
    };
  };

  // 2. Pre-fetch OpenStreetMap tiles covering the viewport
  const tileMinX = Math.floor((centerWorld.x - canvasWidth / 2) / 256);
  const tileMaxX = Math.floor((centerWorld.x + canvasWidth / 2) / 256);
  const tileMinY = Math.floor((centerWorld.y - canvasHeight / 2) / 256);
  const tileMaxY = Math.floor((centerWorld.y + canvasHeight / 2) / 256);

  const tiles: { img: HTMLImageElement; x: number; y: number }[] = [];
  const tilePromises: Promise<void>[] = [];

  for (let tx = tileMinX; tx <= tileMaxX; tx++) {
    for (let ty = tileMinY; ty <= tileMaxY; ty++) {
      const p = new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
        img.onload = () => {
          tiles.push({
            img,
            x: canvasWidth / 2 + (tx * 256 - centerWorld.x),
            y: canvasHeight / 2 + (ty * 256 - centerWorld.y)
          });
          resolve();
        };
        img.onerror = () => resolve(); // Ignore individual tile failures
      });
      tilePromises.push(p);
    }
  }

  // Pre-load employee avatar if available
  let loadedAvatarImg: HTMLImageElement | null = null;
  if (empImage) {
    const avatarPromise = new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = empImage;
      img.onload = () => {
        loadedAvatarImg = img;
        resolve();
      };
      img.onerror = () => resolve();
    });
    tilePromises.push(avatarPromise);
  }

  // Wait max 1.5 seconds for tile pre-loading
  await Promise.race([
    Promise.all(tilePromises),
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]);

  // 3. Setup MediaStream and MediaRecorder
  // 30 FPS stream from canvas
  const stream = canvas.captureStream(30);

  const mimeType =
    typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : 'video/webm';

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const recordingFinished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  recorder.start();

  // 4. Render animation frames (Total 120 frames = 4.0 seconds at 30 fps)
  const totalFrames = 120;
  const projectedRoute = allPoints.map(([lat, lng]) => project(lat, lng));
  const projectedLogs = logs.map((l) => project(l.latitude, l.longitude));

  for (let frame = 0; frame < totalFrames; frame++) {
    const progress = frame / (totalFrames - 1);
    if (onProgress) {
      onProgress(Math.round(progress * 100));
    }

    // A. Fill background (light slate map tone)
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // B. Draw loaded OSM map tiles
    tiles.forEach((t) => {
      try {
        ctx.drawImage(t.img, t.x, t.y, 256, 256);
      } catch (_) {}
    });

    // C. Draw Route Polyline
    if (projectedRoute.length > 1) {
      // Glow underlay
      ctx.beginPath();
      ctx.moveTo(projectedRoute[0].x, projectedRoute[0].y);
      for (let i = 1; i < projectedRoute.length; i++) {
        ctx.lineTo(projectedRoute[i].x, projectedRoute[i].y);
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Sharp primary route line #07518a
      ctx.beginPath();
      ctx.moveTo(projectedRoute[0].x, projectedRoute[0].y);
      for (let i = 1; i < projectedRoute.length; i++) {
        ctx.lineTo(projectedRoute[i].x, projectedRoute[i].y);
      }
      ctx.strokeStyle = '#07518a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // D. Draw Numbered Waypoint Pins
    projectedLogs.forEach((pt, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === projectedLogs.length - 1;

      ctx.save();
      ctx.shadowColor = 'rgba(7, 81, 138, 0.35)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isFirst || isLast ? 14 : 11, 0, Math.PI * 2);
      ctx.fillStyle = isFirst ? '#10B981' : isLast ? '#EF4444' : '#07518a';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();

      // Text inside pin
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), pt.x, pt.y + 0.5);
    });

    // E. Draw Animated Avatar Marker
    const pointProgress = progress * (projectedRoute.length - 1);
    const baseIdx = Math.floor(pointProgress);
    const subRatio = pointProgress - baseIdx;
    const ptA = projectedRoute[Math.min(baseIdx, projectedRoute.length - 1)];
    const ptB = projectedRoute[Math.min(baseIdx + 1, projectedRoute.length - 1)];

    const curX = ptA.x + (ptB.x - ptA.x) * subRatio;
    const curY = ptA.y + (ptB.y - ptA.y) * subRatio;

    // Pulse ring around avatar
    const pulseRadius = 24 + Math.sin(frame * 0.25) * 5;
    ctx.beginPath();
    ctx.arc(curX, curY, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(7, 81, 138, 0.22)';
    ctx.fill();

    // White circle container
    ctx.save();
    ctx.beginPath();
    ctx.arc(curX, curY, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(7, 81, 138, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#07518a';
    ctx.stroke();

    // Clip image inside circular avatar
    ctx.clip();
    if (loadedAvatarImg) {
      try {
        ctx.drawImage(loadedAvatarImg, curX - 20, curY - 20, 40, 40);
      } catch (_) {
        ctx.fillStyle = '#07518a';
        ctx.fillRect(curX - 20, curY - 20, 40, 40);
      }
    } else {
      ctx.fillStyle = '#07518a';
      ctx.fillRect(curX - 20, curY - 20, 40, 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(employeeName.charAt(0).toUpperCase(), curX, curY);
    }
    ctx.restore();

    // F. Top Sleek Overlay Header Banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(16, 16, canvasWidth - 32, 54);

    // Rounded outline
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, canvasWidth - 32, 54);

    // Header Content
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(employeeName.toUpperCase(), 32, 26);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(`GPS Route Timeline  •  ${date}  •  ${logs.length} Pings`, 32, 47);

    // Top Right Brand Badge
    ctx.fillStyle = '#07518a';
    ctx.fillRect(canvasWidth - 110, 26, 78, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LIVE GPS', canvasWidth - 71, 37);

    // G. Bottom Progress Bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(16, canvasHeight - 24, canvasWidth - 32, 6);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(16, canvasHeight - 24, (canvasWidth - 32) * progress, 6);

    // Wait 33ms per frame (~30 fps)
    await new Promise((resolve) => setTimeout(resolve, 33));
  }

  // 5. Complete recording and trigger download
  recorder.stop();
  const videoBlob = await recordingFinished;

  const url = URL.createObjectURL(videoBlob);
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const cleanName = employeeName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${cleanName}_Tracking_${date}.${ext}`;

  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
