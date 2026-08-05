import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cachedQuery } from '@/lib/queryCache';

export interface Country {
  id: string;
  name: string;
  iso_code: string;
  currency_code: string | null;
  currency_symbol: string | null;
  phone_code: string | null;
  is_active: boolean | null;
  lat: number | null;
  lng: number | null;
}

// Countries are effectively static reference data (~200 rows). Selecting `*`
// on every mount was one of the largest single PostgREST payloads a visitor
// produced. We now request only the columns the UI reads and cache the result
// for a week, shared across every hook instance via single-flight.
const COLUMNS = 'id,name,iso_code,currency_code,currency_symbol,phone_code,is_active,lat,lng';
const CACHE_KEY = 'countries:v2';
const TTL = 7 * 24 * 60 * 60 * 1000;

async function fetchCountriesOnce(): Promise<Country[]> {
  const { data, error } = await supabase
    .from('countries')
    .select(COLUMNS)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data as Country[]) ?? [];
}

export const useCountries = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (force = false) => {
    try {
      const data = await cachedQuery(CACHE_KEY, fetchCountriesOnce, {
        ttlMs: force ? 0 : TTL,
      });
      setCountries(data);
    } catch (err) {
      console.error('Error fetching countries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCountryByCode = (code: string) => {
    return countries.find(c => c.iso_code === code);
  };

  const getCountryByName = (name: string) => {
    return countries.find(c => c.name.toLowerCase() === name.toLowerCase());
  };

  return {
    countries,
    loading,
    getCountryByCode,
    getCountryByName,
    refetch: () => load(true),
  };
};

export default useCountries;
