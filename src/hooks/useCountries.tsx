import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export const useCountries = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (!error && data) {
        setCountries(data);
      }
    } catch (err) {
      console.error('Error fetching countries:', err);
    } finally {
      setLoading(false);
    }
  };

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
    refetch: fetchCountries,
  };
};

export default useCountries;
