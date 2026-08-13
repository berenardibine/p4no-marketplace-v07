// Product Likes (product_likes) is RETIRED.
// This hook is intentionally inert: it performs ZERO database reads/writes.
// The table still exists for historical data, but nothing in the app touches it.
// Saved items (`saved_items` via SaveButton) remain the supported feature.
import { Product } from './useProducts';

export const useFavoriteProducts = () => {
  const favorites: Product[] = [];

  return {
    favorites,
    loading: false,
    removeFavorite: async (_productId: string) => {},
    isFavorite: (_productId: string) => false,
    refetch: async () => {},
  };
};
