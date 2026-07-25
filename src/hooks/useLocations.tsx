import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      const { data, error } = await supabase
        .from('provinces')
        .select('*')
        .order('name');
      
      if (!error && data) {
        setProvinces(data);
      }
      setLoading(false);
    };

    fetchProvinces();
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      const fetchDistricts = async () => {
        const { data, error } = await supabase
          .from('districts')
          .select('*')
          .eq('province_id', selectedProvince)
          .order('name');
        
        if (!error && data) {
          setDistricts(data);
        }
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
        const { data, error } = await supabase
          .from('sectors')
          .select('*')
          .eq('district_id', selectedDistrict)
          .order('name');
        
        if (!error && data) {
          setSectors(data);
        }
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
