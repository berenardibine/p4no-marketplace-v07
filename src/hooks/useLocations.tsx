import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cachedQuery } from '@/lib/queryCache';

// Rwanda locations are static reference data: one read per table/parent per day, shared by all callers.
const LOC_TTL = 24 * 60 * 60_000;
const loadLoc = (table: 'provinces' | 'districts' | 'sectors', col?: string, val?: string) =>
  cachedQuery<any[]>(`loc:${table}:${val ?? 'all'}`, async () => {
    let q: any = supabase.from(table).select('*').order('name');
    if (col && val) q = q.eq(col, val);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }, { ttlMs: LOC_TTL });

interface Province {
  id: string;
  name: string;
}

interface District {
  id: string;
  name: string;
  province_id: string;
}

interface Sector {
  id: string;
  name: string;
  district_id: string;
}

export const useLocations = () => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');

  useEffect(() => {
    const fetchProvinces = async () => {
      const data = await loadLoc('provinces').catch(() => null);
      if (data) setProvinces(data);
      setLoading(false);
    };

    fetchProvinces();
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      const fetchDistricts = async () => {
        const data = await loadLoc('districts', 'province_id', selectedProvince).catch(() => null);
        if (data) setDistricts(data);
      };

      fetchDistricts();
      setSelectedDistrict('');
      setSelectedSector('');
      setSectors([]);
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedDistrict) {
      const fetchSectors = async () => {
        const data = await loadLoc('sectors', 'district_id', selectedDistrict).catch(() => null);
        if (data) setSectors(data);
      };

      fetchSectors();
      setSelectedSector('');
    }
  }, [selectedDistrict]);

  return {
    provinces,
    districts,
    sectors,
    loading,
    selectedProvince,
    selectedDistrict,
    selectedSector,
    setSelectedProvince,
    setSelectedDistrict,
    setSelectedSector,
  };
};
