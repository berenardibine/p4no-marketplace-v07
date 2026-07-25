import { Navigation, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LocationPermissionBannerProps {
  onRequestPermission: () => void;
}

const LocationPermissionBanner = ({ onRequestPermission }: LocationPermissionBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={cn(
      "relative p-4 rounded-2xl",
      "bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10",
      "border border-primary/20"
    )}>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <Navigation className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            Enable location for better results
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            p4no needs location access to show nearby products and shops.
          </p>
        </div>
        <Button size="sm" onClick={onRequestPermission} className="shrink-0">
          Enable
        </Button>
      </div>
    </div>
  );
};

export default LocationPermissionBanner;
