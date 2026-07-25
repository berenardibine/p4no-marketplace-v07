import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Percent, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    title: string;
    price: number;
    discount?: number | null;
    discount_expiry?: string | null;
    currency_symbol?: string | null;
  };
  onSuccess: () => void;
}

const DiscountModal = ({ isOpen, onClose, product, onSuccess }: DiscountModalProps) => {
  const { toast } = useToast();
  const [percentage, setPercentage] = useState(product.discount ? String(product.discount) : "");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    product.discount_expiry ? new Date(product.discount_expiry) : undefined
  );
  const [saving, setSaving] = useState(false);

  const percentNum = Number(percentage) || 0;
  const discountedPrice = product.price - (product.price * (percentNum / 100));
  const currencySymbol = product.currency_symbol || "Fr";
  const isValid = percentNum >= 5 && percentNum <= 90 && expiryDate && expiryDate > new Date();

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          discount: percentNum,
          discount_expiry: expiryDate!.toISOString(),
        })
        .eq("id", product.id);

      if (error) throw error;
      toast({ title: "Discount applied! 🎉" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to apply discount", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ discount: 0, discount_expiry: null })
        .eq("id", product.id);

      if (error) throw error;
      toast({ title: "Discount removed" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to remove discount", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('en-RW', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            {product.discount && product.discount > 0 ? "Edit Discount" : "Add Discount"}
          </DialogTitle>
          <DialogDescription>
            {product.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Percentage Input */}
          <div className="space-y-2">
            <Label>Discount Percentage</Label>
            <div className="relative">
              <Input
                type="number"
                min={5}
                max={90}
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                placeholder="Enter 5-90%"
                className="pr-10"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {percentage && (percentNum < 5 || percentNum > 90) && (
              <p className="text-xs text-destructive">Discount must be between 5% and 90%</p>
            )}
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label>Expiry Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiryDate ? format(expiryDate, "PPP") : "Pick expiry date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiryDate}
                  onSelect={setExpiryDate}
                  disabled={(date) => date <= new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Preview */}
          {percentNum >= 5 && percentNum <= 90 && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <div className="flex items-center gap-3">
                <div className="bg-destructive text-destructive-foreground px-2 py-1 rounded-lg text-sm font-bold">
                  -{Math.round(percentNum)}%
                </div>
                <div>
                  <p className="text-sm line-through text-muted-foreground">
                    {currencySymbol} {formatPrice(product.price)}
                  </p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {currencySymbol} {formatPrice(discountedPrice)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {product.discount && product.discount > 0 && (
              <Button
                variant="outline"
                onClick={handleRemove}
                disabled={saving}
                className="text-destructive border-destructive/30"
              >
                Remove
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="flex-1"
            >
              {saving ? "Saving..." : "Apply Discount"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountModal;
