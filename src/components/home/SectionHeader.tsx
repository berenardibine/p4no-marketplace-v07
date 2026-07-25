import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onViewAll?: () => void;
}

const SectionHeader = ({ title, icon, onViewAll }: SectionHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon && (
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        )}
        <h2 className="font-bold text-foreground">{title}</h2>
      </div>
      {onViewAll && (
        <Button variant="ghost" size="sm" className="text-primary gap-0.5 -mr-2">
          View All
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default SectionHeader;
