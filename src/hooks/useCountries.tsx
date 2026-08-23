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
}

// Countries are slow-changing reference data (~200 rows). `select('*')` on every
// mount was one of the largest confirmed public egress sources (~37.8 KB /
// session).
//
// NOTE: this hook previously optimistically requested `reference/countries.json`
// from the static CDN — but the static generator has never produced that file
// (it is absent from the published manifest), so the layer was dead weight and,
// whenever the manifest itself failed to load, surfaced as a CORS-opaque 404 in
// the console. The static hop has been removed: the delivery path is now
//
//   memory (cachedQuery single-flight) → localStorage (7-day TTL) → PostgREST
//
// i.e. at most ONE trimmed PostgREST read per device per week. This is exactly
// what the old code did in practice, since the manifest gate always routed to
// the fallback anyway.
const COLUMNS = 'id,name,iso_code,currency_code,currency_symbol,phone_code,is_active';
const CACHE_KEY = 'countries:v3';
const TTL = 7 * 24 * 60 * 60 * 1000;

/** PostgREST read, trimmed to only the columns the UI renders. */
async function fetchCountriesFromDb(): Promise<Country[]> {
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
      const data = await cachedQuery(CACHE_KEY, fetchCountriesFromDb, { ttlMs: force ? 0 : TTL });
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
