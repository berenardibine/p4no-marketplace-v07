import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

export interface CartItem {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  maxQuantity: number;
  minQuantity: number;
  unlimitedQuantity: boolean;
  sellerId: string;
  sellerName: string;
  currencySymbol?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => boolean;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => string | null;
  clearCart: () => void;
  totalItems: number;
  currentSellerId: string | null;
}

const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const currentSellerId = items.length > 0 ? items[0].sellerId : null;

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    // Check if already in cart
    const existing = items.find(i => i.id === item.id);
    if (existing) {
      toast({ title: "Already in your order list" });
      return true;
    }

    // Check seller constraint
    if (currentSellerId && item.sellerId !== currentSellerId) {
      toast({
        title: "Different seller",
        description: "You can only checkout products from one seller at a time. Clear your current order first.",
        variant: "destructive",
      });
      return false;
    }

    setItems(prev => [...prev, { ...item, quantity: item.minQuantity || 1 }]);
    toast({ title: "Added to order! 🛒" });
    return true;
  }, [items, currentSellerId, toast]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number): string | null => {
    const item = items.find(i => i.id === id);
    if (!item) return null;

    if (quantity < item.minQuantity) {
      return `Minimum quantity is ${item.minQuantity}`;
    }
    if (!item.unlimitedQuantity && quantity > item.maxQuantity) {
      return `Quantity exceeds available stock (${item.maxQuantity})`;
    }

    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
    return null;
  }, [items]);

  const clearCart = useCallback(() => setItems([]), []);

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
      currentSellerId,
    }}>
      {children}
    </CartContext.Provider>
  );
};
