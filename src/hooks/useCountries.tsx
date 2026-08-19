import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cachedQuery } from '@/lib/queryCache';
import { getContent } from '@/lib/cdnGuard';

export interface Country {
  id: string;
  name: string;
  iso_code: string;
  currency_code: string | null;
  currency_symbol: string | null;
  phone_code: string | null;
  is_active: boolean | null;
}

// Countries are slow-changing reference data (~200 rows). `select('*')` on every
// mount was one of the largest confirmed public egress sources (~37.8 KB /
// session). Delivery now follows the standard hierarchy:
//
//   memory → browser HTTP cache → IndexedDB → CDN static JSON → PostgREST
//
// getContent() implements those layers and reports the layer that actually
// served the read to telemetry. cachedQuery() adds a 7-day localStorage
// answer + single-flight, so repeat sessions issue no request at all.
const COLUMNS = 'id,name,iso_code,currency_code,currency_symbol,phone_code,is_active';
const CACHE_KEY = 'countries:v3';
const STATIC_PATH = 'reference/countries';
const TTL = 7 * 24 * 60 * 60 * 1000;

/** Last-resort PostgREST read: trimmed to only the columns the UI renders. */
async function fetchCountriesFromDb(): Promise<Country[]> {
  const { data, error } = await supabase
    .from('countries')
    .select(COLUMNS)
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return (data as Country[]) ?? [];
}

async function loadCountries(): Promise<Country[]> {
  const rows = await getContent<Country[]>(STATIC_PATH, { fallback: fetchCountriesFromDb });
  return Array.isArray(rows) ? rows : [];
}

export const useCountries = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (force = false) => {
    try {
      const data = await cachedQuery(CACHE_KEY, loadCountries, { ttlMs: force ? 0 : TTL });
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
