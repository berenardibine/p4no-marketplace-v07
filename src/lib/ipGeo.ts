// Single-flight IP geolocation.
//
// Both GeoContext and useGeoLocation used to call ipapi.co independently, so a
// cold homepage load produced two identical third-party requests. This module
// collapses them into one call and caches the answer for 24h.

import { cachedQuery } from '@/lib/queryCache';

export interface IpGeo {
  ip: string | null;
  country_code: string | null;
  country_name: string | null;
  currency: string | null;
  latitude: number | null;
  longitude: number | null;
}

const TTL = 24 * 60 * 60 * 1000;

export function fetchIpGeo(): Promise<IpGeo> {
  return cachedQuery<IpGeo>(
    'ipgeo:v1',
    async () => {
      const res = await fetch('https://ipapi.co/json/', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Location detection failed');
      const d = await res.json();
      return {
        ip: d.ip ?? null,
        country_code: d.country_code ?? null,
        country_name: d.country_name ?? null,
        currency: d.currency ?? null,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
      };
    },
    { ttlMs: TTL },
  );
}
