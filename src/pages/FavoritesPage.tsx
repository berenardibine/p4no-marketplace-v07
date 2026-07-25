import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFavoriteProducts } from "@/hooks/useFavorites";
import ProductCard from "@/components/products/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const FavoritesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites, loading, removeFavorite } = useFavoriteProducts();

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary to-orange-500 pt-safe">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg text-white">My Favorites</h1>
            <p className="text-white/80 text-xs">{favorites?.length || 0} items saved</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
            ))}
          </div>
        ) : !favorites || favorites.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-4">
              <Heart className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No favorites yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Tap the heart icon on products you love
            </p>
            <Button onClick={() => navigate('/')}>
              Browse Products
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {favorites.map((product) => (
              <div key={product.id} className="relative">
                <ProductCard
                  id={product.id}
                  title={product.title}
                  price={product.price}
                  images={product.images}
                  location={product.location}
                  is_negotiable={product.is_negotiable}
                  quantity={product.quantity}
                  sellerId={product.seller_id}
                />
                <button
                  onClick={() => removeFavorite(product.id)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;