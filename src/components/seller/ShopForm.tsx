import { useState } from "react";
import { ArrowLeft, Store, Upload, X, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { validateImageFile } from "@/lib/cloudinary";
import { DeliveryRulesEditor, type DeliveryRule } from "@/components/products/DeliveryInfo";

interface ShopFormProps {
  shop?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

const ShopForm = ({ shop, onSubmit, onCancel }: ShopFormProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { upload, isUploading } = useCloudinaryUpload({ folder: 'shops' });
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(shop?.logo_url || '');
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [coverPreview, setCoverPreview] = useState(shop?.cover_image_url || '');
  const [isProcessingCover, setIsProcessingCover] = useState(false);
  const [formData, setFormData] = useState({
    name: shop?.name || '',
    description: shop?.description || '',
    trading_center: shop?.trading_center || '',
    logo_url: shop?.logo_url || '',
    cover_image_url: shop?.cover_image_url || '',
  });
  const [deliveryRules, setDeliveryRules] = useState<DeliveryRule[]>(Array.isArray(shop?.delivery_rules) ? shop.delivery_rules : []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast({ title: validationError, variant: "destructive" });
      return;
    }

    setIsProcessingLogo(true);
    const url = await upload(file);
    if (url) {
      setFormData(prev => ({ ...prev, logo_url: url }));
      setLogoPreview(url);
    }
    setIsProcessingLogo(false);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      toast({ title: validationError, variant: "destructive" });
      return;
    }
    setIsProcessingCover(true);
    const url = await upload(file);
    if (url) {
      setFormData(prev => ({ ...prev, cover_image_url: url }));
      setCoverPreview(url);
    }
    setIsProcessingCover(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cover_image_url) {
      toast({ title: "Cover image required", description: "Please upload a cover image before saving your shop.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const r = deliveryRules.filter(d => d.country.trim());
      await onSubmit({ ...formData, delivery_rules: r.length ? r : null });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={onCancel}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg">
            {shop ? 'Edit Shop' : 'Create Your Shop'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Cover Image Upload (required) */}
        <div className="space-y-2">
          <Label>Cover Image *</Label>
          <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 to-secondary/20 border-2 border-dashed border-primary/50 flex items-center justify-center">
            {isProcessingCover ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-1" />
                <span className="text-xs text-muted-foreground">Optimizing</span>
              </div>
            ) : coverPreview ? (
              <>
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setCoverPreview(''); setFormData(p => ({ ...p, cover_image_url: '' })); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                <Upload className="h-8 w-8 text-primary/60 mb-1" />
                <span className="text-xs text-muted-foreground">Upload Cover Image (required)</span>
                <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* Logo Upload */}
        <div className="text-center">
          <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border-2 border-dashed border-primary/50 flex items-center justify-center overflow-hidden relative">
            {isProcessingLogo ? (
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-1" />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Optimizing
                </span>
              </div>
            ) : logoPreview ? (
              <>
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview('');
                    setFormData(prev => ({ ...prev, logo_url: '' }));
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                <Upload className="h-8 w-8 text-primary/50 mb-1" />
                <span className="text-xs text-muted-foreground">Upload Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Shop Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Shop Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter your shop name"
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe your shop and what you sell..."
            rows={3}
          />
        </div>

        {/* Trading Center */}
        <div className="space-y-2">
          <Label htmlFor="trading_center">Trading Center / Market Location</Label>
          <Input
            id="trading_center"
            value={formData.trading_center}
            onChange={(e) => setFormData(prev => ({ ...prev, trading_center: e.target.value }))}
            placeholder="e.g., Nyabugogo Market, Kimironko Market"
          />
        </div>

        {/* Default delivery rules (used for all this shop's products unless a product overrides) */}
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Default delivery fees for your products. Charged once per order.</p>
          <DeliveryRulesEditor value={deliveryRules} onChange={setDeliveryRules} />
        </div>

        {/* Contact Info (Auto-filled) */}
        <div className="bg-muted/50 rounded-xl p-4 space-y-2">
          <h3 className="font-medium text-sm">Contact Information (from your profile)</h3>
          <p className="text-sm text-muted-foreground">
            📞 Call: {profile?.call_number || 'Not set'}
          </p>
          <p className="text-sm text-muted-foreground">
            💬 WhatsApp: {profile?.whatsapp_number || 'Not set'}
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving...' : (shop ? 'Update Shop' : 'Create Shop')}
        </Button>
      </form>
    </div>
  );
};

export default ShopForm;
