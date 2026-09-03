'use client';

import { useEffect } from 'react';

const BACKEND_PORTS = new Set(['5005', '5000']);

function resolveBaseTarget(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return window.location.origin;
}

function shouldRewriteHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname === window.location.hostname) return true;
  return [
    '173.249.6.61',
    'newhrms.brihaspathi.in',
    '172.21.2.137',
    '172.21.4.18',
    '183.82.117.36',
  ].includes(hostname);
}

function replaceUrl(urlStr: string, baseTarget: string): string {
  if (!urlStr) return urlStr;
  try {
    const absolute = new URL(urlStr, window.location.origin);
    if (!BACKEND_PORTS.has(absolute.port)) return urlStr;
    if (!shouldRewriteHost(absolute.hostname)) return urlStr;
    return `${baseTarget}${absolute.pathname}${absolute.search}${absolute.hash}`;
  } catch {
    return urlStr;
  }
}

export default function FetchPatcher() {
  useEffect(() => {
    const originalFetch = window.fetch;
    const baseTarget = resolveBaseTarget();

    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      if (typeof input === 'string') {
        return originalFetch.call(this, replaceUrl(input, baseTarget), init);
      }
      if (input instanceof URL) {
        return originalFetch.call(this, replaceUrl(input.href, baseTarget), init);
      }
      if (input && typeof input === 'object' && 'url' in input && typeof (input as Request).url === 'string') {
        const patchedUrl = replaceUrl((input as Request).url, baseTarget);
        if (patchedUrl !== (input as Request).url) {
          return originalFetch.call(this, patchedUrl, init || (input as RequestInit));
        }
      }

      return originalFetch.call(this, input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const disableAutocomplete = () => {
      try {
        const inputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
        inputs.forEach((input) => {
          if (input.getAttribute('autocomplete') !== 'off') {
            input.setAttribute('autocomplete', 'off');
          }
          if (input.getAttribute('autocomplete') !== 'off') {
            input.setAttribute('autoComplete', 'off');
          }
        });
        const forms = document.querySelectorAll('form');
        forms.forEach((form) => {
          if (form.getAttribute('autocomplete') !== 'off') {
            form.setAttribute('autocomplete', 'off');
          }
        });
      } catch {}
    };

    disableAutocomplete();
    const observer = new MutationObserver(() => disableAutocomplete());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
