import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useCountries, Country } from '@/hooks/useCountries';
import { useGPSLocation, saveLocationToDB } from '@/hooks/useGPSLocation';
import { useAuth } from '@/hooks/useAuth';
import { fetchIpGeo } from '@/lib/ipGeo';

interface GeoContextType {
  country: string | null;
  countryCode: string | null;
  currencyCode: string | null;
  currencySymbol: string | null;
  phoneCode: string | null;
  ip: string | null;
  lat: number | null;
  lng: number | null;
  loading: boolean;
  isManualOverride: boolean;
  permissionDenied: boolean;
  countries: Country[];
  setLocation: (country: Country) => void;
  clearOverride: () => void;
  requestLocationPermission: () => void;
  formatPrice: (price: number, overrideCurrency?: string, overrideSymbol?: string) => string;
}

const GeoContext = createContext<GeoContextType | undefined>(undefined);

const STORAGE_KEY = 'smartmarket_geo';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const GeoProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { countries, loading: countriesLoading, getCountryByCode } = useCountries();
  const { coords: gpsCoords, loading: gpsLoading, permissionDenied, requestPermission } = useGPSLocation();
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState({
    country: null as string | null,
    countryCode: null as string | null,
    currencyCode: null as string | null,
    currencySymbol: null as string | null,
    phoneCode: null as string | null,
    ip: null as string | null,
    isManualOverride: false,
  });

  // Detect location on mount
  useEffect(() => {
    if (countriesLoading) return;
    
    const initializeLocation = async () => {
      // Check for cached data first
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const now = Date.now();
          
          if (parsed.timestamp && (now - parsed.timestamp) < CACHE_DURATION) {
            setGeoData({
              country: parsed.country,
              countryCode: parsed.countryCode,
              currencyCode: parsed.currencyCode,
              currencySymbol: parsed.currencySymbol,
              phoneCode: parsed.phoneCode,
              ip: parsed.ip,
              isManualOverride: parsed.isManualOverride || false,
            });
            setLoading(false);
            return;
          }
        } catch (e) {
          // Invalid cache
        }
      }
      
      // Fetch fresh location data
      await detectLocation();
    };
    
    initializeLocation();
  }, [countriesLoading, countries]);

  // Persist GPS location to the DB for authenticated users whenever it changes.
  useEffect(() => {
    if (user && gpsCoords) {
      saveLocationToDB(user, gpsCoords);
    }
  }, [user, gpsCoords]);

  const detectLocation = async () => {
    try {
      setLoading(true);
      
      const data = await fetchIpGeo();
      
      // Match with our countries database
      const matchedCountry = countries.find(
        c => c.iso_code === data.country_code
      );
      
      const result = {
        country: matchedCountry?.name || data.country_name || 'Rwanda',
        countryCode: matchedCountry?.iso_code || data.country_code || 'RW',
        currencyCode: matchedCountry?.currency_code || data.currency || 'RWF',
        currencySymbol: matchedCountry?.currency_symbol || data.currency || 'R₣',
        phoneCode: matchedCountry?.phone_code || '+250',
        ip: data.ip || null,
        isManualOverride: false,
      };
      
      setGeoData(result);
      
      // Cache result
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...result,
        timestamp: Date.now(),
      }));
      
    } catch (err) {
      console.error('Geolocation error:', err);
      
      // Default to Rwanda
      const defaultCountry = countries.find(c => c.iso_code === 'RW');
      setGeoData({
        country: defaultCountry?.name || 'Rwanda',
        countryCode: defaultCountry?.iso_code || 'RW',
        currencyCode: defaultCountry?.currency_code || 'RWF',
        currencySymbol: defaultCountry?.currency_symbol || 'R₣',
        phoneCode: defaultCountry?.phone_code || '+250',
        ip: null,
        isManualOverride: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const setLocation = (country: Country) => {
    const result = {
      country: country.name,
      countryCode: country.iso_code,
      currencyCode: country.currency_code,
      currencySymbol: country.currency_symbol,
      phoneCode: country.phone_code,
      ip: geoData.ip,
      isManualOverride: true,
    };
    
    setGeoData(result);
    
    // Update cache
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...result,
      timestamp: Date.now(),
    }));
    
    // Store in session for components that need quick access
    sessionStorage.setItem('user_country', country.name);
    sessionStorage.setItem('user_country_code', country.iso_code);
    sessionStorage.setItem('currency_code', country.currency_code || '');
  };

  const clearOverride = () => {
    localStorage.removeItem(STORAGE_KEY);
    detectLocation();
  };

  // Format price with currency
  const formatPrice = (
    price: number, 
    overrideCurrency?: string, 
    overrideSymbol?: string
  ): string => {
    const symbol = overrideSymbol || geoData.currencySymbol || '';
    const currency = overrideCurrency || geoData.currencyCode || 'RWF';
    
    try {
      // Use Intl.NumberFormat for proper formatting
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(price);
      
      return `${symbol} ${formatted}`;
    } catch {
      return `${symbol} ${price.toLocaleString()}`;
    }
  };

  return (
    <GeoContext.Provider value={{
      ...geoData,
      lat: gpsCoords?.lat ?? null,
      lng: gpsCoords?.lng ?? null,
      loading: loading || countriesLoading,
      permissionDenied,
      countries,
      setLocation,
      clearOverride,
      requestLocationPermission: requestPermission,
      formatPrice,
    }}>
      {children}
    </GeoContext.Provider>
  );
};

export const useGeo = () => {
  const context = useContext(GeoContext);
  if (context === undefined) {
    throw new Error('useGeo must be used within a GeoProvider');
  }
  return context;
};
