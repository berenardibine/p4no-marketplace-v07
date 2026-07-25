import { useState, useEffect } from 'react';
import { MapPin, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    provinceId: string,
    districtId: string,
    sectorId: string,
    provinceName: string,
    districtName: string,
    sectorName: string
  ) => Promise<void>;
}

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

const LocationModal = ({ isOpen, onClose, onSave }: LocationModalProps) => {
  const { toast } = useToast();
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');

  useEffect(() => {
    fetchProvinces();
  }, []);

  useEffect(() => {
    if (selectedProvince) {
      fetchDistricts(selectedProvince);
      setSelectedDistrict('');
      setSelectedSector('');
      setSectors([]);
    }
  }, [selectedProvince]);

  useEffect(() => {
    if (selectedDistrict) {
      fetchSectors(selectedDistrict);
      setSelectedSector('');
    }
  }, [selectedDistrict]);

  const fetchProvinces = async () => {
    const { data } = await supabase
      .from('provinces')
      .select('*')
      .order('name');
    setProvinces(data || []);
  };

  const fetchDistricts = async (provinceId: string) => {
    const { data } = await supabase
      .from('districts')
      .select('*')
      .eq('province_id', provinceId)
      .order('name');
    setDistricts(data || []);
  };

  const fetchSectors = async (districtId: string) => {
    const { data } = await supabase
      .from('sectors')
      .select('*')
      .eq('district_id', districtId)
      .order('name');
    setSectors(data || []);
  };

  const handleSave = async () => {
    if (!selectedProvince || !selectedDistrict || !selectedSector) {
      toast({ title: 'Please select all location fields', variant: 'destructive' });
      return;
    }

    const province = provinces.find(p => p.id === selectedProvince);
    const district = districts.find(d => d.id === selectedDistrict);
    const sector = sectors.find(s => s.id === selectedSector);

    setLoading(true);
    try {
      await onSave(
        selectedProvince,
        selectedDistrict,
        selectedSector,
        province?.name || '',
        district?.name || '',
        sector?.name || ''
      );
      toast({ title: '✅ Location saved! Showing products near your area.' });
    } catch (err) {
      toast({ title: 'Failed to save location', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            Set Your Location
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Select your location to see products and services near you.
          </p>

          {/* Province */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Province</label>
            <Select value={selectedProvince} onValueChange={setSelectedProvince}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {provinces.map(province => (
                  <SelectItem key={province.id} value={province.id}>
                    {province.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* District */}
          <div className="space-y-2">
            <label className="text-sm font-medium">District</label>
            <Select 
              value={selectedDistrict} 
              onValueChange={setSelectedDistrict}
              disabled={!selectedProvince}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {districts.map(district => (
                  <SelectItem key={district.id} value={district.id}>
                    {district.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Sector</label>
            <Select 
              value={selectedSector} 
              onValueChange={setSelectedSector}
              disabled={!selectedDistrict}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select sector" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map(sector => (
                  <SelectItem key={sector.id} value={sector.id}>
                    {sector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            className="flex-1 gap-2 bg-gradient-to-r from-primary to-secondary" 
            onClick={handleSave}
            disabled={loading || !selectedSector}
          >
            <Check className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Location'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationModal;