import { useNavigate } from "react-router-dom";
import { Home, Car, Wheat, Wrench, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems: NavItem[] = [
  { id: "home", label: "Home", icon: <Home className="h-4 w-6" />, href: "/" },
  { id: "asset", label: "Asset", icon: <Car className="h-4 w-6" />, href: "/assets" },
  { id: "reels", label: "Reels", icon: <Play className="h-4 w-6" />, href: "/reels" },
  { id: "agriculture", label: "Agri", icon: <Wheat className="h-4 w-6" />, href: "/agriculture" },
  { id: "rent", label: "Rent", icon: <Wrench className="h-4 w-6" />, href: "/rent" },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const navigate = useNavigate();

  const handleClick = (item: NavItem) => {
    onTabChange(item.id);
    navigate(item.href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-orange-100 safe-bottom">
      <div className="flex items-center justify-around h-7 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-all duration-200 tap-highlight-none",
                isActive 
                  ? "text-orange-600" 
                  : "text-gray-400 hover:text-orange-500"
              )}
            >
              <div className={cn(
                "transition-transform duration-200",
                isActive && "scale-110"
              )}>
                {item.icon}
              </div>
              
              <span className={cn(
                "text-[10px] font-medium",
                isActive && "font-semibold text-orange-600"
              )}>
                {item.label}
              </span>

              {isActive && (
                <div className="absolute bottom-1 w-6 h-0.5 rounded-full bg-orange-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
