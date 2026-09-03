/**
 * Dynamic Device Detection & Identifier Helpers
 */

const MODEL_NAME_MAP: Record<string, string> = {
  // iQOO Models
  'I2301': 'iQOO Z7 Pro 5G',
  'I2219': 'iQOO Z7 Pro 5G',
  'I2202': 'iQOO Neo 7',
  'I2011': 'iQOO 7 5G',
  'I2220': 'iQOO Z7 5G',
  'I2208': 'iQOO 11 5G',
  'I2304': 'iQOO 12 5G',
  'I2307': 'iQOO Neo 9 Pro',
  
  // Vivo Models
  'V2025': 'Vivo V20',
  'V2111': 'Vivo Y21',
  'V2130': 'Vivo V23 5G',
  'V2238': 'Vivo V27 5G',
  'V2250': 'Vivo V29 5G',

  // Oppo & Realme Models
  'CPH2083': 'Oppo A12',
  'CPH2363': 'Oppo F21 Pro',
  'RMX3085': 'Realme 8 5G',

  // Samsung Models
  'SM-M315F': 'Samsung Galaxy M31',
  'SM-A525F': 'Samsung Galaxy A52',
  'SM-G998B': 'Samsung Galaxy S21 Ultra',
};

export function getDeviceIdentifier(): string {
  if (typeof window === 'undefined') return 'WEB_CLIENT';
  
  let deviceId = localStorage.getItem('hrms_device_uuid');
  if (!deviceId) {
    // Generate a unique, persistent Device UUID for this device/phone
    const randomPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const timePart = Date.now().toString(36);
    deviceId = `DEV-UUID-${timePart}-${randomPart}`.toUpperCase();
    localStorage.setItem('hrms_device_uuid', deviceId);
  }
  return deviceId;
}

export function initDeviceModel(): string {
  if (typeof window === 'undefined') return 'Web Client';

  const nav = window.navigator as any;
  const ua = window.navigator.userAgent;
  let browserName = 'Chrome';
  if (/Edg/i.test(ua)) browserName = 'Edge';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browserName = 'Safari';
  else if (/Firefox/i.test(ua)) browserName = 'Firefox';

  // 1. High Entropy API Detection
  if (nav.userAgentData && typeof nav.userAgentData.getHighEntropyValues === 'function') {
    nav.userAgentData.getHighEntropyValues(['model', 'platform', 'brands'])
      .then((uaData: any) => {
        let rawModel = uaData.model ? uaData.model.trim() : '';
        let formattedModel = '';

        if (rawModel && rawModel !== 'K') {
          const upperModel = rawModel.toUpperCase();
          if (MODEL_NAME_MAP[upperModel]) {
            formattedModel = MODEL_NAME_MAP[upperModel];
          } else if (/^I2\d{3}$/i.test(rawModel) || /iQOO/i.test(rawModel)) {
            formattedModel = `iQOO Phone (${rawModel})`;
          } else if (/^V2\d{3}$/i.test(rawModel) || /Vivo/i.test(rawModel)) {
            formattedModel = `Vivo Phone (${rawModel})`;
          } else if (/^CPH\d{4}$/i.test(rawModel) || /Oppo/i.test(rawModel)) {
            formattedModel = `Oppo Phone (${rawModel})`;
          } else if (/^RMX\d{4}$/i.test(rawModel) || /Realme/i.test(rawModel)) {
            formattedModel = `Realme Phone (${rawModel})`;
          } else if (/^SM-[A-Z0-9]+/i.test(rawModel) || /Samsung/i.test(rawModel)) {
            formattedModel = `Samsung Galaxy (${rawModel})`;
          } else {
            formattedModel = `Android Mobile (${rawModel})`;
          }
        }

        if (formattedModel) {
          localStorage.setItem('hrms_device_model_cached', `${formattedModel} (${browserName})`);
        }
      })
      .catch(() => {});
  }

  const cachedModel = localStorage.getItem('hrms_device_model_cached');
  if (cachedModel && cachedModel.trim() !== '') {
    return cachedModel;
  }

  // 2. Fallback User Agent Regex Parsing
  let phoneModel = '';

  if (/iPhone/i.test(ua)) {
    phoneModel = 'Apple iPhone';
  } else if (/iPad/i.test(ua)) {
    phoneModel = 'Apple iPad';
  } else if (/iQOO/i.test(ua)) {
    phoneModel = 'iQOO Mobile Phone';
  } else if (/Vivo|V2\d{3}|V1\d{3}/i.test(ua)) {
    phoneModel = 'Vivo Mobile Phone';
  } else if (/Oppo|CPH\d{4}/i.test(ua)) {
    phoneModel = 'Oppo Mobile Phone';
  } else if (/Realme|RMX\d{4}/i.test(ua)) {
    phoneModel = 'Realme Mobile Phone';
  } else if (/Samsung|SM-[A-Z0-9]+/i.test(ua)) {
    phoneModel = 'Samsung Galaxy';
  } else if (/OnePlus/i.test(ua)) {
    phoneModel = 'OnePlus Mobile';
  } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
    phoneModel = 'Xiaomi / Redmi Mobile';
  } else if (/Pixel/i.test(ua)) {
    phoneModel = 'Google Pixel';
  } else if (/Android/i.test(ua)) {
    phoneModel = 'Android Mobile Device';
  }

  if (!phoneModel) {
    if (/Windows/i.test(ua)) phoneModel = `Windows PC (${browserName})`;
    else if (/Macintosh|Mac OS/i.test(ua)) phoneModel = `Mac Desktop (${browserName})`;
    else phoneModel = `Web Browser (${browserName})`;
  } else {
    phoneModel = `${phoneModel} (${browserName})`;
  }

  return phoneModel;
}

export function getDeviceModel(): string {
  return initDeviceModel();
}
