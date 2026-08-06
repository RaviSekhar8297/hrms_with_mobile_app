'use client';

import { useEffect } from 'react';

export default function FetchPatcher() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalFetch = window.fetch;
      window.fetch = async function (input, init) {
        let targetInput = input;
        if (typeof input === 'string' && input.includes('http://localhost:5000')) {
          targetInput = input.replace('http://localhost:5000', `http://${window.location.hostname}:5000`);
        } else if (input instanceof URL && input.href.includes('http://localhost:5000')) {
          targetInput = new URL(input.href.replace('http://localhost:5000', `http://${window.location.hostname}:5000`));
        } else if (input && typeof input === 'object' && 'url' in input && typeof (input as any).url === 'string' && (input as any).url.includes('http://localhost:5000')) {
          const newUrl = (input as any).url.replace('http://localhost:5000', `http://${window.location.hostname}:5000`);
          targetInput = new Request(newUrl, input as RequestInit);
        }
        return originalFetch(targetInput, init);
      };
    }
  }, []);

  return null;
}
