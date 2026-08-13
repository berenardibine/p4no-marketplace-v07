import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

// Product Likes is retired — this page no longer reads `product_likes`.
// Users are pointed to Saved items, which is the supported feature.
const FavoritesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary to-orange-500 pt-safe">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg text-white">Saved items</h1>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-4">
            <Bookmark className="h-10 w-10 text-primary" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Favorites moved to Saved</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Use the save button on any product to keep it here.
          </p>
          <Button onClick={() => navigate('/saved')}>Go to Saved</Button>
        </div>
      </div>
    </div>
  );
};

export default FavoritesPage;
