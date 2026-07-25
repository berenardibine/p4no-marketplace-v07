import { MapPin, ChevronDown, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmartLocationHeaderProps {
  locationLabel: string;
  onChangeLocation: () => void;
}

const SmartLocationHeader = ({ locationLabel, onChangeLocation }: SmartLocationHeaderProps) => {
  return (
    <button
      onClick={onChangeLocation}
      className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-2xl w-full",
        "bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10",
        "border border-primary/20 hover:border-primary/40",
        "transition-all duration-300 group"
      )}
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
        <MapPin className="h-5 w-5 text-white" />
      </div>
      
      <div className="flex-1 text-left">
        <p className="text-xs text-muted-foreground">📍 Your Location</p>
        <p className="font-semibold text-foreground flex items-center gap-1">
          {locationLabel}
          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </p>
      </div>
      
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Edit2 className="h-4 w-4 text-primary" />
      </div>
    </button>
  );
};

export default SmartLocationHeader;