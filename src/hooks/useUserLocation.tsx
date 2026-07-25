import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type LocationLevel = 'sector' | 'district' | 'province' | 'country';

interface UserLocation {
  provinceId: string | null;
  provinceName: string | null;
  districtId: string | null;
  districtName: string | null;
  sectorId: string | null;
  sectorName: string | null;
}

export const useUserLocation = () => {
  const { user, profile } = useAuth();
  const [location, setLocation] = useState<UserLocation>({
    provinceId: null,
    provinceName: null,
    districtId: null,
    districtName: null,
    sectorId: null,
    sectorName: null,
  });
  const [level, setLevel] = useState<LocationLevel>('sector');
  const [loading, setLoading] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Load user's saved location
  useEffect(() => {
    if (profile) {
      loadUserLocation();
    } else {
      setLoading(false);
    }
  }, [profile]);

  const loadUserLocation = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    try {
      // Get location names from IDs
      let provinceName = null;
      let districtName = null;
      let sectorName = null;

      if (profile.province_id) {
        const { data } = await supabase
          .from('provinces')
          .select('name')
          .eq('id', profile.province_id)
          .single();
        provinceName = data?.name || null;
      }

      if (profile.district_id) {
        const { data } = await supabase
          .from('districts')
          .select('name')
          .eq('id', profile.district_id)
          .single();
        districtName = data?.name || null;
      }

      if (profile.sector_id) {
        const { data } = await supabase
          .from('sectors')
          .select('name')
          .eq('id', profile.sector_id)
          .single();
        sectorName = data?.name || null;
      }

      setLocation({
        provinceId: profile.province_id,
        provinceName,
        districtId: profile.district_id,
        districtName,
        sectorId: profile.sector_id,
        sectorName,
      });

      // If no location set, show modal
      if (!profile.province_id && !profile.district_id && !profile.sector_id) {
        setShowLocationModal(true);
      }
    } catch (err) {
      console.error('Error loading user location:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveUserLocation = async (
    provinceId: string,
    districtId: string,
    sectorId: string,
    provinceName: string,
    districtName: string,
    sectorName: string
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          province_id: provinceId,
          district_id: districtId,
          sector_id: sectorId,
        })
        .eq('id', user.id);

      if (error) throw error;

      setLocation({
        provinceId,
        provinceName,
        districtId,
        districtName,
        sectorId,
        sectorName,
      });

      setShowLocationModal(false);
    } catch (err) {
      console.error('Error saving location:', err);
      throw err;
    }
  };

  const getLocationFilter = useCallback(() => {
    switch (level) {
      case 'sector':
        return { field: 'sector_id', value: location.sectorId };
      case 'district':
        return { field: 'district_id', value: location.districtId };
      case 'province':
        return { field: 'province_id', value: location.provinceId };
      case 'country':
        return { field: null, value: null };
      default:
        return { field: 'sector_id', value: location.sectorId };
    }
  }, [level, location]);

  const getLocationLabel = () => {
    if (!location.sectorName && !location.districtName && !location.provinceName) {
      return 'Set your location';
    }

    switch (level) {
      case 'sector':
        return `${location.sectorName || 'Unknown'}, ${location.districtName || ''}`;
      case 'district':
        return `${location.districtName || 'Unknown'}, ${location.provinceName || ''}`;
      case 'province':
        return location.provinceName || 'Unknown Province';
      case 'country':
        return 'All Rwanda';
      default:
        return location.sectorName || 'Set location';
    }
  };

  return {
    location,
    level,
    setLevel,
    loading,
    showLocationModal,
    setShowLocationModal,
    saveUserLocation,
    getLocationFilter,
    getLocationLabel,
    refetch: loadUserLocation,
  };
};