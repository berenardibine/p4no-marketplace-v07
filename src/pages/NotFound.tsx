import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, Search, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotFoundProps {
  message?: string;
}

const NotFound = ({ message }: NotFoundProps) => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-primary/5 p-8">
      <div className="text-center max-w-md">
        {/* Animated Icon */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center animate-pulse-slow">
          <ShoppingBag className="h-12 w-12 text-primary" />
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold text-primary mb-3">Oops! 😊</h1>
        
        {/* Message */}
        <p className="text-lg text-muted-foreground mb-6">
          {message || "We couldn't find what you're looking for."}
        </p>

        {/* Suggestions */}
        <div className="bg-card rounded-2xl p-4 mb-6 border shadow-soft">
          <p className="text-sm text-muted-foreground mb-3">Try these instead:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link to="/" className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20 transition-colors">
              🏠 Home
            </Link>
            <Link to="/" className="px-3 py-1.5 bg-secondary/10 text-secondary rounded-full text-sm hover:bg-secondary/20 transition-colors">
              🛒 Browse Products
            </Link>
          </div>
        </div>

        {/* Main Action */}
        <Button asChild size="lg" className="gap-2 shadow-orange">
          <Link to="/">
            <Home className="h-5 w-5" />
            Go Back Home
          </Link>
        </Button>

        {/* Footer */}
        <p className="text-xs text-muted-foreground mt-8">
          Rwanda p4no — Your Market. Your Area. Your Power. 🛍️
        </p>
      </div>
    </div>
  );
};

export default NotFound;
