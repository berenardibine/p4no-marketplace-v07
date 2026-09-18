import { useState, useEffect } from "react";
import { ArrowLeft, X, Plus, Loader2, Sparkles, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useToast } from "@/hooks/use-toast";
import { useProcessedUpload } from "@/hooks/useProcessedUpload";
import { validateImageFile, uploadToCloudinary, optimizeCloudinaryUrl } from "@/lib/cloudinary";
import { processAndUploadVideo, VIDEO_LIMITS, type UploadProgress } from "@/lib/videoProcessor";
import FeatureGate from "@/components/system/FeatureGate";
import { Video, X as XIcon } from "lucide-react";

interface ProductFormProps {
  product?: any;
  shopId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const RENTAL_UNITS = [
  { value: 'day', label: '/day' },
  { value: 'week', label: '/week' },
  { value: 'month', label: '/month' },
  { value: 'year', label: '/year' },
  { value: 'custom', label: '/custom' },
];

const ProductForm = ({ product, shopId, onSuccess, onCancel }: ProductFormProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { categories } = useCategories();
  const { upload, isUploading, processingStage } = useProcessedUpload({ folder: 'products', addWatermark: true });
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [aiEnhanceLoading, setAiEnhanceLoading] = useState(false);
  const [structured, setStructured] = useState<any>((product as any)?.description_structured || null);
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [processingImages, setProcessingImages] = useState<Set<number>>(new Set());
  const [videoUrl, setVideoUrl] = useState(product?.video_url || '');
  const [videoThumbnail, setVideoThumbnail] = useState(product?.video_thumbnail || '');
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState<UploadProgress | null>(null);
  const [tagsInput, setTagsInput] = useState<string>((product?.tags || []).join(', '));
  const [formData, setFormData] = useState({
    title: product?.title || '',
    description: product?.description || '',
    price: product?.price?.toString() || '',
    quantity: product?.quantity?.toString() || '1',
    minimum_quantity: product?.minimum_quantity?.toString() || '1',
    unlimited_quantity: product?.unlimited_quantity || false,
    category: product?.category || '',
    product_type: product?.product_type || 'retail',
    is_negotiable: product?.is_negotiable || false,
    // Rental fields
    rental_fee: product?.rental_fee?.toString() || '',
    rental_unit: product?.rental_unit || 'day',
  });

  // Check if selected category is a rental category
  const isRentalCategory = formData.category?.toLowerCase().includes('rent') || 
    formData.category?.toLowerCase().includes('lent') ||
    formData.product_type === 'rental';

  const slugify = (s: string) =>
    s.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);

  const generateAi = async (mode: "fill" | "regenerate") => {
    if (!formData.title || formData.title.length < 3) return;
    const setter = mode === "regenerate" ? setAiDescLoading : setAiLoading;
    setter(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-suggest', {
        body: { title: formData.title, category: formData.category, mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.seo_description) {
        setFormData(prev => ({
          ...prev,
          title: mode === "regenerate" ? prev.title : (data.seo_title || prev.title),
          description: data.seo_description,
        }));
        toast({ title: "✨ AI description ready", description: `${data.seo_description.length} characters generated.` });
      }
    } catch (err: any) {
      toast({ title: "AI generation failed", description: err.message || "Please retry.", variant: "destructive" });
    } finally {
      setter(false);
    }
  };

  const enhanceWithAi = async () => {
    if (!formData.title || formData.title.length < 3) {
      toast({ title: "Add a product title first", variant: "destructive" });
      return;
    }
    setAiEnhanceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enhance-product-content', {
        body: { title: formData.title, category: formData.category, description: formData.description },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStructured(data.description_structured || null);
      if (data?.tags?.length) setTagsInput(data.tags.join(', '));
      // Short description stays short (max ~50 words); rich content lives in the structured fields
      const ds = data.description_structured;
      if (ds?.overview) {
        const words = String(ds.overview).trim().split(/\s+/);
        setFormData(prev => ({ ...prev, description: words.slice(0, 50).join(' ') }));
      }
      toast({ title: "✨ Enhanced with AI", description: "Structured content, tags & FAQs generated." });
    } catch (err: any) {
      toast({ title: "AI enhancement failed", description: err.message || "Please retry.", variant: "destructive" });
    } finally {
      setAiEnhanceLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (images.length + files.length > 2) {
      toast({ title: "Maximum 2 images allowed", variant: "destructive" });
      return;
    }

    for (const file of Array.from(files)) {
      const validationError = validateImageFile(file);
      if (validationError) {
        toast({ title: validationError, variant: "destructive" });
        continue;
      }

      const currentIndex = images.length;
      setProcessingImages(prev => new Set(prev).add(currentIndex));
      // Add placeholder
      setImages(prev => [...prev, '']);

      const url = await upload(file);
      if (url) {
        setImages(prev => prev.map((img, idx) => idx === currentIndex ? url : img));
      } else {
        setImages(prev => prev.filter((_, idx) => idx !== currentIndex));
      }
      setProcessingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentIndex);
        return newSet;
      });
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploading(true);
    setVideoProgress({ stage: 'validating', percent: 0, message: 'Preparing…' });
    try {
      const result = await processAndUploadVideo(file, (p) => setVideoProgress(p));
      setVideoUrl(result.url);
      setVideoThumbnail(result.thumbnailUrl);
      const sizeKb = (result.bytes / 1024).toFixed(0);
      toast({
        title: '✅ Video optimized & uploaded',
        description: `${result.duration.toFixed(1)}s • ${sizeKb}KB (mobile-ready)`,
      });
    } catch (err: any) {
      toast({ title: 'Video upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setVideoUploading(false);
      setVideoProgress(null);
      e.target.value = '';
    }
  };


  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !profile) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }

    // Block unverified sellers only if admin has enabled the requirement
    // We need to check admin_settings for require_identity_verification
    if (!product?.id) {
      const { data: setting } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'require_identity_verification')
        .maybeSingle();
      
      // Parse the setting value - default to false (not required) if not set
      let requireVerification = false;
      if (setting) {
        let val = setting.value;
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch {}
        }
        requireVerification = val === true;
      }

      if (requireVerification && !(profile as any).identity_verified) {
        toast({ 
          title: "Verification required", 
          description: "You must verify your identity before posting products. Go to your seller dashboard to start verification.",
          variant: "destructive" 
        });
        return;
      }
    }

    if (images.length === 0) {
      toast({ title: "Please add at least one image", variant: "destructive" });
      return;
    }

    // Enforce minimum description length for SEO
    const descLen = (formData.description || "").trim().length;
    if (descLen < 800) {
      toast({
        title: "Description too short",
        description: `Minimum 800 characters required (currently ${descLen}). Use AI Generate to create a full SEO description.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const productData: any = {
        title: formData.title,
        description: formData.description,
        description_structured: structured,
        slug: product?.slug || slugify(formData.title),
        price: formData.price ? parseFloat(formData.price) : 0,
        quantity: parseInt(formData.quantity),
        minimum_quantity: parseInt(formData.minimum_quantity) || 1,
        unlimited_quantity: formData.unlimited_quantity,
        category: formData.category || null,
        product_type: isRentalCategory ? 'rental' : formData.product_type,
        is_negotiable: formData.is_negotiable,
        images: images,
        video_url: videoUrl || null,
        video_thumbnail: videoThumbnail || null,
        tags: tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 20),
        seller_id: user.id,
        shop_id: shopId || null,
        location: null,
        location_id: profile.sector_id,
        contact_whatsapp: profile.whatsapp_number,
        contact_call: profile.call_number,
        status: 'active',
        // Global country fields - auto-filled from seller profile
        country: profile.country || null,
        currency_code: profile.currency_code || 'RWF',
        currency_symbol: profile.currency_symbol || 'R₣',
        // GPS coordinates from seller profile
        lat: (profile as any).lat || null,
        lng: (profile as any).lng || null,
      };

      // Add rental fields if applicable
      if (isRentalCategory) {
        productData.rental_fee = formData.rental_fee ? parseFloat(formData.rental_fee) : parseFloat(formData.price);
        productData.rental_unit = formData.rental_unit;
        productData.rental_status = 'available';
      }

      if (product?.id) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);
        
        if (error) throw error;
      }

      onSuccess();
    } catch (err: any) {
      toast({ title: "Failed to save product", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
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
            {product ? 'Edit Product' : 'Add New Product'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Image Upload */}
        <div className="space-y-3">
          <Label>Product Images (Max 2) *</Label>
          <div className="grid grid-cols-4 gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                {processingImages.has(idx) && (
                   <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mb-1" />
                    <span className="text-xs text-muted-foreground">{processingStage || 'Processing...'}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground"
                  disabled={processingImages.has(idx)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {images.length < 2 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-primary/50 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors">
                <Plus className="h-6 w-6 text-primary/50 mb-1" />
                <span className="text-xs text-muted-foreground">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>


        {/* Product Name */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="title">Product Name *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 rounded-lg border-primary/30 text-primary hover:bg-primary/5"
              disabled={!formData.title || formData.title.length < 3 || aiLoading}
              onClick={() => generateAi("fill")}
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              AI Optimize
            </Button>
          </div>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter product name (min 3 chars for AI)"
            required
          />
          <p className="text-xs text-muted-foreground">Type a name then tap "AI Optimize" for SEO suggestions</p>
        </div>

        {/* Price & Quantity */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">
              Price (RWF) {!formData.is_negotiable && '*'}
            </Label>
            <Input
              id="price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              placeholder={formData.is_negotiable ? "Optional" : "0"}
              required={!formData.is_negotiable}
            />
            {formData.is_negotiable && (
              <p className="text-xs text-muted-foreground">Optional when price is negotiable</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
              placeholder="1"
              required
              min="1"
              disabled={formData.unlimited_quantity}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_qty">Minimum Order Qty</Label>
            <Input
              id="min_qty"
              type="number"
              value={formData.minimum_quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, minimum_quantity: e.target.value }))}
              placeholder="1"
              min="1"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Switch
              checked={formData.unlimited_quantity}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, unlimited_quantity: checked }))}
            />
            <Label>Unlimited quantity</Label>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-card">
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.slug}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rental Fields - Show automatically for rental categories */}
        {isRentalCategory && (
          <div className="bg-primary/5 rounded-2xl p-4 space-y-4 border border-primary/20">
            <h3 className="font-semibold flex items-center gap-2 text-primary">
              🔧 Rental Fee Details
            </h3>
            <p className="text-sm text-muted-foreground">
              This category requires rental pricing. Set the fee rate below.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rental Fee (RWF)</Label>
                <Input
                  type="number"
                  value={formData.rental_fee || formData.price}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    rental_fee: e.target.value,
                    price: e.target.value // Sync with main price
                  }))}
                  placeholder="50000"
                />
              </div>
              <div className="space-y-2">
                <Label>Rate Unit</Label>
                <Select
                  value={formData.rental_unit}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    rental_unit: value 
                  }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    {RENTAL_UNITS.map(unit => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-primary font-medium">
              Display: Fr {formData.rental_fee || formData.price || '0'}/{formData.rental_unit}
            </p>
          </div>
        )}

        {/* Product Type - Hide for rental categories */}
        {!isRentalCategory && (
          <div className="space-y-2">
            <Label>Product Type</Label>
            <Select
              value={formData.product_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, product_type: value }))}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Negotiable */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
          <div>
            <Label htmlFor="negotiable">Price is Negotiable</Label>
            <p className="text-sm text-muted-foreground">Allow buyers to negotiate the price</p>
          </div>
          <Switch
            id="negotiable"
            checked={formData.is_negotiable}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_negotiable: checked }))}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="description">Description * <span className="text-xs text-muted-foreground">(min 800 chars)</span></Label>
            <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 rounded-lg border-amber-500/40 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              disabled={!formData.title || formData.title.length < 3 || aiEnhanceLoading}
              onClick={enhanceWithAi}
            >
              {aiEnhanceLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Enhance with AI
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 rounded-lg border-primary/30 text-primary hover:bg-primary/5"
              disabled={!formData.title || formData.title.length < 3 || aiDescLoading}
              onClick={() => generateAi("regenerate")}
            >
              {aiDescLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {formData.description ? "Regenerate" : "Generate"}
            </Button>
            </div>
          </div>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Type your product name above, then tap Generate to create an SEO-optimized 800+ char description."
            rows={10}
            required
          />
          <div className="flex items-center justify-between text-xs">
            <span className={(formData.description?.length || 0) < 800 ? "text-destructive" : "text-green-600 dark:text-green-400"}>
              {formData.description?.length || 0} / 800 characters
            </span>
            {(formData.description?.length || 0) < 800 && (
              <span className="text-muted-foreground">
                {800 - (formData.description?.length || 0)} more needed
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma separated, helps search)</Label>
          <Input
            id="tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. iphone, smartphone, used, kigali"
          />
          <p className="text-xs text-muted-foreground">Up to 20 tags. Improves search ranking.</p>
        </div>

        {/* Short Video (max 30s) */}
        <FeatureGate feature="reels_module">
        <div className="space-y-2">
          <Label>Short Video (optional, max {VIDEO_LIMITS.MAX_DURATION}s)</Label>
          {videoUrl ? (
            <div className="relative rounded-xl overflow-hidden bg-muted">
              <video src={videoUrl} controls poster={videoThumbnail || undefined} className="w-full max-h-64" />
              <button
                type="button"
                onClick={() => { setVideoUrl(''); setVideoThumbnail(''); }}
                className="absolute top-2 right-2 w-8 h-8 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-primary/40 cursor-pointer hover:bg-primary/5">
              {videoUploading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs font-medium text-foreground">{videoProgress?.message || 'Processing video…'}</span>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${videoProgress?.percent ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Final size must be ≤ 2MB after optimization</span>
                </>
              ) : (
                <>
                  <Video className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Upload short video</span>
                  <span className="text-xs text-muted-foreground">≤ {VIDEO_LIMITS.MAX_DURATION}s • auto-thumbnail • watermarked</span>
                </>
              )}
              <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" disabled={videoUploading} />
            </label>
          )}
        </div>
        </FeatureGate>

        {/* Location Info */}
        <div className="bg-primary/5 rounded-xl p-4">
          <h3 className="font-medium text-sm mb-2">📍 Location (Auto-filled)</h3>
          <p className="text-sm text-muted-foreground">
            Location will be set from your profile
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={loading || isUploading || processingImages.size > 0}>
          {isUploading || processingImages.size > 0 ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {processingStage || 'Processing images...'}
            </span>
          ) : loading ? 'Saving...' : (product ? 'Update Product' : 'Add Product')}
        </Button>
      </form>
    </div>
  );
};

export default ProductForm;