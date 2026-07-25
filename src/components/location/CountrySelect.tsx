import { useState, useEffect } from 'react';
import { ChevronDown, Globe, Search, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Country } from '@/hooks/useCountries';

interface CountrySelectProps {
  countries: Country[];
  value?: string;
  onChange: (country: Country) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCurrency?: boolean;
  showPhoneCode?: boolean;
}

// Country flag emoji helper
const getCountryFlag = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const CountrySelect = ({
  countries,
  value,
  onChange,
  placeholder = "Select country",
  disabled = false,
  className,
  showCurrency = false,
  showPhoneCode = false,
}: CountrySelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const selectedCountry = countries.find(c => c.iso_code === value || c.name === value);
  
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(search.toLowerCase()) ||
    country.iso_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (country: Country) => {
    onChange(country);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between rounded-xl h-12 px-4",
            !selectedCountry && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {selectedCountry ? (
              <>
                <span className="text-lg">{getCountryFlag(selectedCountry.iso_code)}</span>
                <span className="truncate">{selectedCountry.name}</span>
                {showCurrency && selectedCountry.currency_code && (
                  <span className="text-xs text-muted-foreground">
                    ({selectedCountry.currency_symbol})
                  </span>
                )}
                {showPhoneCode && selectedCountry.phone_code && (
                  <span className="text-xs text-muted-foreground">
                    {selectedCountry.phone_code}
                  </span>
                )}
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 shrink-0" />
                <span>{placeholder}</span>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[280px] p-0 bg-card" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-2">
            {filteredCountries.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                No countries found
              </div>
            ) : (
              filteredCountries.map((country) => (
                <button
                  key={country.id}
                  onClick={() => handleSelect(country)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    "hover:bg-muted text-left",
                    selectedCountry?.id === country.id && "bg-primary/10"
                  )}
                >
                  <span className="text-xl">{getCountryFlag(country.iso_code)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{country.name}</div>
                    <div className="text-xs text-muted-foreground flex gap-2">
                      {country.currency_code && (
                        <span>{country.currency_symbol} {country.currency_code}</span>
                      )}
                      {country.phone_code && (
                        <span>{country.phone_code}</span>
                      )}
                    </div>
                  </div>
                  {selectedCountry?.id === country.id && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default CountrySelect;
