import { useState, useEffect } from 'react';
import { Globe, MapPin, RefreshCw, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGeo } from '@/context/GeoContext';
import CountrySelect from './CountrySelect';
import { Country } from '@/hooks/useCountries';
import { cn } from '@/lib/utils';

interface GlobalLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalLocationModal = ({ isOpen, onClose }: GlobalLocationModalProps) => {
  const { 
    country, 
    countryCode, 
    currencySymbol, 
    phoneCode,
    isManualOverride,
    countries,
    setLocation,
    clearOverride,
    loading 
  } = useGeo();
  
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  useEffect(() => {
    if (countryCode && countries.length > 0) {
      const found = countries.find(c => c.iso_code === countryCode);
      if (found) setSelectedCountry(found);
    }
  }, [countryCode, countries]);

  const handleSave = () => {
    if (selectedCountry) {
      setLocation(selectedCountry);
      onClose();
    }
  };

  const handleReset = () => {
    clearOverride();
    onClose();
  };

  // Get country flag emoji
  const getFlag = (code: string) => {
    if (!code || code.length !== 2) return '🌍';
    return String.fromCodePoint(
      ...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Your Location
          </DialogTitle>
          <DialogDescription>
            We'll show you products and shops from your selected country
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Detection Display */}
          {country && (
            <div className={cn(
              "p-4 rounded-xl border-2 transition-colors",
              isManualOverride ? "border-primary/50 bg-primary/5" : "border-muted"
            )}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getFlag(countryCode || '')}</span>
                <div className="flex-1">
                  <p className="font-semibold">{country}</p>
                  <div className="text-sm text-muted-foreground flex gap-2">
                    <span>{currencySymbol}</span>
                    <span>•</span>
                    <span>{phoneCode}</span>
                  </div>
                </div>
                {isManualOverride && (
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary">
                    Manual
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Country Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Change Location
            </label>
            <CountrySelect
              countries={countries}
              value={selectedCountry?.iso_code || countryCode || ''}
              onChange={setSelectedCountry}
              placeholder="Select your country"
              showCurrency
              showPhoneCode
            />
          </div>

          {/* Preview of selected country */}
          {selectedCountry && selectedCountry.iso_code !== countryCode && (
            <div className="p-3 rounded-lg bg-muted/50 border border-dashed border-primary/30">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Products will be filtered to: <strong>{selectedCountry.name}</strong></span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Currency: {selectedCountry.currency_symbol} {selectedCountry.currency_code}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {isManualOverride && (
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Auto-detect
            </Button>
          )}
          <Button 
            className="flex-1 gap-2"
            onClick={handleSave}
            disabled={!selectedCountry || loading}
          >
            <Check className="h-4 w-4" />
            Confirm Location
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalLocationModal;
