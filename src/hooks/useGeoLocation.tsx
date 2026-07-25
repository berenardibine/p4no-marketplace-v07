import { useState, useEffect, useCallback } from 'react';
import { useCountries, Country } from './useCountries';

interface GeoLocationData {
  country: string | null;
  countryCode: string | null;
  currencyCode: string | null;
  currencySymbol: string | null;
  ip: string | null;
  loading: boolean;
  error: string | null;
}

const STORAGE_KEY = 'smartmarket_geo';
const GEO_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const useGeoLocation = () => {
  const { countries, getCountryByCode } = useCountries();
  const [geoData, setGeoData] = useState<GeoLocationData>({
    country: null,
    countryCode: null,
    currencyCode: null,
    currencySymbol: null,
    ip: null,
    loading: true,
    error: null,
  });
  const [manualOverride, setManualOverride] = useState<Country | null>(null);

  // Load cached geo data
  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        
        // Check if cache is still valid
        if (parsed.timestamp && (now - parsed.timestamp) < GEO_CACHE_DURATION) {
          setGeoData({
            country: parsed.country,
            countryCode: parsed.countryCode,
            currencyCode: parsed.currencyCode,
            currencySymbol: parsed.currencySymbol,
            ip: parsed.ip,
            loading: false,
            error: null,
          });
          return;
        }
      } catch (e) {
        // Invalid cache, proceed with fresh fetch
      }
    }
    
    // Fetch fresh geo data
    detectLocation();
  }, []);

  const detectLocation = async () => {
    try {
      setGeoData(prev => ({ ...prev, loading: true, error: null }));
      
      // Use ipapi.co for free IP geolocation
      const response = await fetch('https://ipapi.co/json/', {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to detect location');
      }
      
      const data = await response.json();
      
      // Find matching country in our database
      const matchedCountry = countries.find(
        c => c.iso_code === data.country_code
      );
      
      const geoResult = {
        country: data.country_name || null,
        countryCode: data.country_code || null,
        currencyCode: matchedCountry?.currency_code || data.currency || null,
        currencySymbol: matchedCountry?.currency_symbol || data.currency || null,
        ip: data.ip || null,
        loading: false,
        error: null,
      };
      
      setGeoData(geoResult);
      
      // Cache the result
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...geoResult,
        timestamp: Date.now(),
      }));
      
    } catch (err: any) {
      console.error('Geolocation error:', err);
      setGeoData(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to detect location',
      }));
      
      // Default to Rwanda if detection fails
      setGeoData({
        country: 'Rwanda',
        countryCode: 'RW',
        currencyCode: 'RWF',
        currencySymbol: 'R₣',
        ip: null,
        loading: false,
        error: null,
      });
    }
  };

  const setManualLocation = useCallback((country: Country) => {
    setManualOverride(country);
    
    const geoResult = {
      country: country.name,
      countryCode: country.iso_code,
      currencyCode: country.currency_code,
      currencySymbol: country.currency_symbol,
      ip: geoData.ip,
      loading: false,
      error: null,
    };
    
    setGeoData(geoResult);
    
    // Cache manual selection
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...geoResult,
      manual: true,
      timestamp: Date.now(),
    }));
    
    // Also store in session for quick access
    sessionStorage.setItem('user_country', country.name);
    sessionStorage.setItem('user_country_code', country.iso_code);
    sessionStorage.setItem('currency_code', country.currency_code || '');
    sessionStorage.setItem('currency_symbol', country.currency_symbol || '');
  }, [geoData.ip]);

  const clearOverride = useCallback(() => {
    setManualOverride(null);
    localStorage.removeItem(STORAGE_KEY);
    detectLocation();
  }, []);

  // Get effective location (manual override or detected)
  const effectiveCountry = manualOverride?.name || geoData.country;
  const effectiveCountryCode = manualOverride?.iso_code || geoData.countryCode;
  const effectiveCurrencyCode = manualOverride?.currency_code || geoData.currencyCode;
  const effectiveCurrencySymbol = manualOverride?.currency_symbol || geoData.currencySymbol;

  return {
    ...geoData,
    country: effectiveCountry,
    countryCode: effectiveCountryCode,
    currencyCode: effectiveCurrencyCode,
    currencySymbol: effectiveCurrencySymbol,
    isManualOverride: !!manualOverride,
    setManualLocation,
    clearOverride,
    refresh: detectLocation,
  };
};

export default useGeoLocation;
