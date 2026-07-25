import { MapPin, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocations } from '@/hooks/useLocations';
import { useEffect } from 'react';

interface LocationSelectProps {
  onProvinceChange: (id: string) => void;
  onDistrictChange: (id: string) => void;
  onSectorChange: (id: string) => void;
  provinceValue?: string;
  districtValue?: string;
  sectorValue?: string;
}

const LocationSelect = ({
  onProvinceChange,
  onDistrictChange,
  onSectorChange,
  provinceValue,
  districtValue,
  sectorValue,
}: LocationSelectProps) => {
  const {
    provinces,
    districts,
    sectors,
    loading,
    selectedProvince,
    selectedDistrict,
    setSelectedProvince,
    setSelectedDistrict,
    setSelectedSector,
  } = useLocations();

  const handleProvinceChange = (value: string) => {
    setSelectedProvince(value);
    onProvinceChange(value);
    onDistrictChange('');
    onSectorChange('');
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    onDistrictChange(value);
    onSectorChange('');
  };

  const handleSectorChange = (value: string) => {
    setSelectedSector(value);
    onSectorChange(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <MapPin className="h-4 w-4" />
        <span className="text-sm font-medium">Your Location</span>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Province</Label>
          <Select
            value={provinceValue || selectedProvince}
            onValueChange={handleProvinceChange}
            disabled={loading}
          >
            <SelectTrigger className="h-12 bg-white/80 border-border/50">
              <SelectValue placeholder="Select province" />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((province) => (
                <SelectItem key={province.id} value={province.id}>
                  {province.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">District</Label>
          <Select
            value={districtValue || selectedDistrict}
            onValueChange={handleDistrictChange}
            disabled={!selectedProvince && !provinceValue}
          >
            <SelectTrigger className="h-12 bg-white/80 border-border/50">
              <SelectValue placeholder="Select district" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((district) => (
                <SelectItem key={district.id} value={district.id}>
                  {district.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Sector</Label>
          <Select
            value={sectorValue}
            onValueChange={handleSectorChange}
            disabled={!selectedDistrict && !districtValue}
          >
            <SelectTrigger className="h-12 bg-white/80 border-border/50">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              {sectors.map((sector) => (
                <SelectItem key={sector.id} value={sector.id}>
                  {sector.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default LocationSelect;
