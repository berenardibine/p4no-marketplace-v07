import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Loader2, Check, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInstantOrder, type InstantOrderProduct } from '@/hooks/useInstantOrder';

interface Props {
  product: InstantOrderProduct;
  defaultQuantity?: number;
  showQuantity?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  variant?: 'solid' | 'icon';
  onSuccess?: () => void;
}

const sizeMap = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-14 px-5 text-base',
};

const OrderNowButton = ({
  product,
  defaultQuantity,
  showQuantity = false,
  className,
  size = 'lg',
  label = 'Order Now',
  variant = 'solid',
  onSuccess,
}: Props) => {
  const minQ = 1;
  const maxQ = product.unlimited_quantity ? 9999 : Math.max(1, product.quantity ?? 1);
  const [qty, setQty] = useState(Math.min(maxQ, Math.max(minQ, defaultQuantity ?? minQ)));
  const [success, setSuccess] = useState(false);
  const { placeOrder, submitting } = useInstantOrder();

  const handleClick = async () => {
    const ok = await placeOrder({ product, quantity: qty });
    if (ok) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1800);
      onSuccess?.();
    }
  };

  if (variant === 'icon') {
    return (
      <motion.button
        whileTap={{ scale: 0.92 }}
        disabled={submitting}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleClick(); }}
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg active:shadow-md transition-shadow',
          'h-10 w-10',
          className
        )}
        aria-label="Order now"
      >
        <AnimatePresence mode="wait">
          {success ? (
            <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Check className="h-5 w-5" />
            </motion.span>
          ) : submitting ? (
            <Loader2 key="ld" className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingBag key="ic" className="h-5 w-5" />
          )}
        </AnimatePresence>
      </motion.button>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {showQuantity && (
        <div className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-2">
          <span className="text-xs text-muted-foreground font-medium">Quantity</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQty(q => Math.max(minQ, q - 1))}
              className="w-8 h-8 rounded-lg bg-background border flex items-center justify-center disabled:opacity-50"
              disabled={qty <= minQ}
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-10 text-center font-bold">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(q => Math.min(maxQ, q + 1))}
              className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center disabled:opacity-50"
              disabled={qty >= maxQ}
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={submitting}
        onClick={handleClick}
        className={cn(
          'relative w-full inline-flex items-center justify-center gap-2 rounded-2xl font-bold',
          'bg-gradient-to-r from-primary via-primary to-primary/85 text-primary-foreground',
          'shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 active:shadow-md',
          'transition-all overflow-hidden',
          sizeMap[size],
          submitting && 'opacity-90 cursor-wait'
        )}
      >
        <AnimatePresence mode="wait">
          {success ? (
            <motion.span
              key="success"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="inline-flex items-center gap-2"
            >
              <Check className="h-5 w-5" />
              Sent to WhatsApp!
            </motion.span>
          ) : submitting ? (
            <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Placing order...
            </motion.span>
          ) : (
            <motion.span key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

export default OrderNowButton;
