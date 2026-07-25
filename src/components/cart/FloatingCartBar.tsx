import { useNavigate, useLocation } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { motion, AnimatePresence } from "framer-motion";

const FloatingCartBar = () => {
  const { items, totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on checkout page or when cart is empty
  if (items.length === 0 || location.pathname === '/checkout') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-8 md:max-w-sm"
      >
        <button
          onClick={() => navigate('/checkout')}
          className="w-full flex items-center justify-between gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-xl hover:shadow-2xl transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm">Proceed to Checkout</p>
              <p className="text-xs opacity-80">{items.length} product{items.length > 1 ? 's' : ''} · {totalItems} item{totalItems > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
            {items.length}
          </div>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingCartBar;
