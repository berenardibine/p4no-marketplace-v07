import { useEffect, useState } from 'react';
import PhoneInput, { isValidPhoneNumber, type Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useGeo } from '@/context/GeoContext';
import { cn } from '@/lib/utils';

interface SmartPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string; // ISO2
  placeholder?: string;
  id?: string;
  className?: string;
  showHint?: boolean;
}

/**
 * Phone input that auto-selects the user's detected country (via GeoContext / IP)
 * and formats numbers in international E.164 (+CCxxxxxxxxx) compatible with WhatsApp.
 * Users can override the country at any time via the dropdown.
 */
const SmartPhoneInput = ({
  value,
  onChange,
  defaultCountry,
  placeholder = 'Phone number',
  id,
  className,
  showHint = true,
}: SmartPhoneInputProps) => {
  const { countryCode, country } = useGeo();
  const initial = (defaultCountry || countryCode || 'RW').toUpperCase() as Country;
  const [selectedCountry, setSelectedCountry] = useState<Country>(initial);

  useEffect(() => {
    // Update if detection arrives after mount and user hasn't typed yet
    if (!value && countryCode) {
      setSelectedCountry(countryCode.toUpperCase() as Country);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode]);

  const isValid = !value || isValidPhoneNumber(value);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        className={cn(
          'phone-input-wrapper flex items-center h-12 rounded-md border bg-background px-3',
          !isValid ? 'border-destructive' : 'border-input',
        )}
      >
        <PhoneInput
          id={id}
          international
          countryCallingCodeEditable={false}
          defaultCountry={initial}
          country={selectedCountry}
          onCountryChange={(c) => c && setSelectedCountry(c)}
          value={value}
          onChange={(v) => onChange(v || '')}
          placeholder={placeholder}
          className="flex-1 [&_input]:bg-transparent [&_input]:outline-none [&_input]:text-sm [&_input]:w-full [&_.PhoneInputCountrySelect]:bg-transparent"
        />
      </div>
      {showHint && country && (
        <p className="text-[11px] text-muted-foreground">
          We detected your country as <span className="font-medium text-foreground">{country}</span>. Tap the flag to change.
        </p>
      )}
      {!isValid && (
        <p className="text-xs text-destructive">Invalid number for selected country</p>
      )}
    </div>
  );
};

export default SmartPhoneInput;