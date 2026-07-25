import { Home, Building2, MapPin, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LocationLevel } from '@/hooks/useUserLocation';

interface LocationLevelFilterProps {
  level: LocationLevel;
  onLevelChange: (level: LocationLevel) => void;
}

const levels: { id: LocationLevel; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'sector', label: 'Sector', icon: <Home className="h-4 w-4" />, color: 'from-green-500 to-emerald-400' },
  { id: 'district', label: 'District', icon: <Building2 className="h-4 w-4" />, color: 'from-blue-500 to-cyan-400' },
  { id: 'province', label: 'Province', icon: <MapPin className="h-4 w-4" />, color: 'from-purple-500 to-violet-400' },
  { id: 'country', label: 'Rwanda', icon: <Globe className="h-4 w-4" />, color: 'from-primary to-orange-400' },
];

const LocationLevelFilter = ({ level, onLevelChange }: LocationLevelFilterProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
      {levels.map((item) => {
        const isActive = level === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onLevelChange(item.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 shrink-0",
              isActive 
                ? `bg-gradient-to-r ${item.color} text-white shadow-lg shadow-primary/20 scale-105` 
                : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default LocationLevelFilter;