import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { fetchIpGeo } from '@/lib/ipGeo';

interface GPSCoords {
  lat: number;
  lng: number;
  accuracy: number;
  source: 'gps' | 'ip' | 'manual';
  country?: string;
  city?: string;
  region?: string;
}

const GPS_CACHE_KEY = 'smartmarket_gps';
const GPS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for fresher data
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Round to ~11m precision (3 decimals ≈ 111m, 4 decimals ≈ 11m)
const roundCoord = (n: number, decimals = 4) => Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);

// Round to 3 decimals (~111m) for frontend display privacy
export const obfuscateCoord = (n: number) => Math.round(n * 1000) / 1000;

export const useGPSLocation = () => {
  const [coords, setCoords] = useState<GPSCoords | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Load cached GPS data
  useEffect(() => {
    const cached = localStorage.getItem(GPS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < GPS_CACHE_DURATION) {
          setCoords({
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: parsed.accuracy,
            source: parsed.source,
            country: parsed.country,
            city: parsed.city,
            region: parsed.region,
          });
          setLoading(false);
          return;
        }
      } catch (e) {
        // Invalid cache
      }
    }
    detectLocation();
  }, []);

  // Background refresh every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        detectLocation(true);
      }
    }, UPDATE_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const detectLocation = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    
    // Throttle: don't update more than once per 30 minutes
    if (Date.now() - lastUpdateRef.current < GPS_CACHE_DURATION) {
      if (!silent) setLoading(false);
      return;
    }

    try {
      // Try browser GPS first
      const gpsResult = await tryBrowserGPS();
      if (gpsResult) {
        // Enrich with IP data for country/city info
        const ipData = await fetchIPLocation();
        const enriched: GPSCoords = {
          ...gpsResult,
          country: ipData?.country || undefined,
          city: ipData?.city || undefined,
          region: ipData?.region || undefined,
        };
        
        setCoords(enriched);
        cacheCoords(enriched);
        lastUpdateRef.current = Date.now();
        setLoading(false);
        return;
      }
    } catch {
      // GPS failed, fall through to IP
    }

    // Fallback to IP geolocation
    try {
      const ipData = await fetchIPLocation();
      if (ipData) {
        const ipCoords: GPSCoords = {
          lat: roundCoord(ipData.latitude),
          lng: roundCoord(ipData.longitude),
          accuracy: 50000, // ~50km accuracy for IP
          source: 'ip',
          country: ipData.country,
          city: ipData.city,
          region: ipData.region,
        };
        
        setCoords(ipCoords);
        cacheCoords(ipCoords);
        lastUpdateRef.current = Date.now();
      }
    } catch (err) {
      console.error('IP geolocation failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const tryBrowserGPS = (): Promise<GPSCoords | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPermissionDenied(false);
          resolve({
            lat: roundCoord(position.coords.latitude),
            lng: roundCoord(position.coords.longitude),
            accuracy: position.coords.accuracy,
            source: 'gps',
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setPermissionDenied(true);
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000, // 1 minute max age for accuracy
        }
      );
    });
  };

  const fetchIPLocation = async () => {
    try {
      // Shared single-flight + 24h cached lookup (avoids duplicate ipapi.co calls)
      const data = await fetchIpGeo();
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        country: data.country_name,
        city: data.city,
        region: data.region,
        ip: data.ip,
        countryCode: data.country_code,
      };
    } catch {
      return null;
    }
  };

  const cacheCoords = (data: GPSCoords) => {
    localStorage.setItem(
      GPS_CACHE_KEY,
      JSON.stringify({ ...data, timestamp: Date.now() })
    );
    // Also store in session for quick access
    sessionStorage.setItem('user_lat', String(data.lat));
    sessionStorage.setItem('user_lng', String(data.lng));
  };

  const requestPermission = useCallback(async () => {
    setPermissionDenied(false);
    lastUpdateRef.current = 0; // Reset throttle
    await detectLocation();
  }, [detectLocation]);

  return {
    coords,
    loading,
    permissionDenied,
    requestPermission,
    refresh: () => {
      lastUpdateRef.current = 0;
      detectLocation();
    },
  };
};

export const saveLocationToDB = async (user: User | null, data: GPSCoords) => {
  if (!user) return;
  try {
    await supabase
      .from('profiles')
      .update({
        lat: data.lat,
        lng: data.lng,
        city: data.city || null,
        region: data.region || null,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', user.id);
    
    // Auto-sync seller location to ALL their products (trigger also does this)
    await supabase
      .from('products')
      .update({ lat: data.lat, lng: data.lng })
      .eq('seller_id', user.id);
    
    // Update seller's shop
    await supabase
      .from('shops')
      .update({
        lat: data.lat,
        lng: data.lng,
        city: data.city || null,
        region: data.region || null,
      })
      .eq('seller_id', user.id);
  } catch (err) {
    console.error('Failed to save location to DB:', err);
  }
};

export default useGPSLocation;
