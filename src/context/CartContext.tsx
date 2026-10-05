import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DeliveryRule } from "@/components/products/DeliveryInfo";

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
  deliveryRules?: DeliveryRule[] | null;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, onAdded?: () => void) => boolean;
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
  const [pending, setPending] = useState<{ item: Omit<CartItem, 'quantity'>; onAdded?: () => void } | null>(null);

  const currentSellerId = items.length > 0 ? items[0].sellerId : null;

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, onAdded?: () => void) => {
    // Check if already in cart
    const existing = items.find(i => i.id === item.id);
    if (existing) {
      toast({ title: "Already in your order list" });
      return true;
    }

    // Check seller constraint
    if (currentSellerId && item.sellerId !== currentSellerId) {
      setPending({ item, onAdded });
      return false;
    }

    setItems(prev => [...prev, { ...item, quantity: item.minQuantity || 1 }]);
    toast({ title: "Added to cart" });
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
      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart contains products from another seller. Clear your cart to shop from this seller?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!pending) return;
              const { item, onAdded } = pending;
              setItems([{ ...item, quantity: item.minQuantity || 1 }]);
              setPending(null);
              toast({ title: "Added to cart" });
              onAdded?.();
            }}>Clear Cart & Add</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CartContext.Provider>
  );
};
