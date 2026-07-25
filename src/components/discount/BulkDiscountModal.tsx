import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Percent, Tag, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: { id: string; title: string; price: number }[];
  onSuccess: () => void;
}

const BulkDiscountModal = ({ isOpen, onClose, products, onSuccess }: BulkDiscountModalProps) => {
  const { toast } = useToast();
  const [percentage, setPercentage] = useState("");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const percentNum = Number(percentage) || 0;
  const isValid = percentNum >= 5 && percentNum <= 90 && expiryDate && expiryDate > new Date();

  const handleApply = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const productIds = products.map(p => p.id);
      
      // Update all products in batches
      const batchSize = 50;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const { error } = await supabase
          .from("products")
          .update({
            discount: percentNum,
            discount_expiry: expiryDate!.toISOString(),
          })
          .in("id", batch);

        if (error) throw error;
      }

      toast({ title: `Discount applied to ${products.length} products! 🎉` });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to apply bulk discount", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAll = async () => {
    if (!confirm(`Remove discount from all ${products.length} products?`)) return;
    setSaving(true);
    try {
      const productIds = products.map(p => p.id);
      const batchSize = 50;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const { error } = await supabase
          .from("products")
          .update({ discount: 0, discount_expiry: null })
          .in("id", batch);
        if (error) throw error;
      }
      toast({ title: "Discount removed from all products" });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to remove discounts", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Bulk Discount
          </DialogTitle>
          <DialogDescription>
            Apply discount to all {products.length} products at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Product Count Info */}
          <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
            <p className="text-sm font-medium text-foreground">
              <Tag className="h-4 w-4 inline mr-1.5 text-primary" />
              {products.length} products will be updated
            </p>
          </div>

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
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
              <div className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg text-sm font-bold inline-block">
                -{Math.round(percentNum)}% on all products
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRemoveAll}
              disabled={saving}
              className="text-destructive border-destructive/30"
            >
              Remove All
            </Button>
            <Button
              onClick={handleApply}
              disabled={!isValid || saving}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {saving ? "Applying..." : `Apply to ${products.length} Products`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkDiscountModal;
