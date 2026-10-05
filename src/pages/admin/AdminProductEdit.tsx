import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, X, Plus, Video, Loader2, 
  Phone, MapPin, Save, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProcessedUpload } from '@/hooks/useProcessedUpload';
import { validateImageFile, uploadToCloudinary, optimizeCloudinaryUrl } from '@/lib/cloudinary';
import { processVideo } from '@/lib/videoProcessor';
import { useCategories } from '@/hooks/useCategories';
import { useLocations } from '@/hooks/useLocations';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';

const RENTAL_UNITS = [
  { value: '', label: 'Not for rent' },
  { value: 'day', label: '/day' },
  { value: 'week', label: '/week' },
  { value: 'month', label: '/month' },
  { value: 'year', label: '/year' },
];

const AdminProductEdit = () => {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { categories } = useCategories();
  const {
    provinces,
    districts,
    sectors,
    selectedProvince,
    selectedDistrict,
    selectedSector,
    setSelectedProvince,
    setSelectedDistrict,
    setSelectedSector,
  } = useLocations();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [processingImages, setProcessingImages] = useState<Set<number>>(new Set());
  const [videoUrl, setVideoUrl] = useState('');
  const [videoThumbnail, setVideoThumbnail] = useState('');
  const [videoUploading, setVideoUploading] = useState(false);
  const [tagsInput, setTagsInput] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    quantity: '1',
    minimum_quantity: '1',
    unlimited_quantity: false,
    category: '',
    product_type: 'retail',
    is_negotiable: false,
    admin_posted: false,
    sponsored: false,
    admin_phone: '',
    admin_shop_name: '',
    contact_call: '',
    contact_whatsapp: '',
    rental_fee: '',
    rental_unit: '',
  });

  const generateAi = async () => {
    if (!formData.title || formData.title.length < 3) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-suggest', {
        body: { title: formData.title, category: formData.category, mode: 'fill' },
      });
      if (error) throw error;
      if (data?.seo_description) {
        setFormData(prev => ({
          ...prev,
          title: data.seo_title || prev.title,
          description: data.seo_description,
        }));
        toast({ title: '✨ AI description ready' });
      }
    } catch (err: any) {
      toast({ title: 'AI generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error || !data) {
        toast({ title: "Product not found", variant: "destructive" });
        navigate('/admin/products');
        return;
      }

      setFormData({
        title: data.title || '',
        description: data.description || '',
        price: data.price?.toString() || '',
        quantity: data.quantity?.toString() || '1',
        minimum_quantity: (data as any).minimum_quantity?.toString() || '1',
        unlimited_quantity: (data as any).unlimited_quantity || false,
        category: data.category || '',
        product_type: data.product_type || 'retail',
        is_negotiable: data.is_negotiable || false,
        admin_posted: data.admin_posted || false,
        sponsored: data.sponsored || false,
        admin_phone: data.admin_phone || '',
        admin_shop_name: (data as any).admin_shop_name || '',
        contact_call: data.contact_call || '',
        contact_whatsapp: data.contact_whatsapp || '',
        rental_fee: data.rental_fee?.toString() || '',
        rental_unit: data.rental_unit || '',
      });
      setTagsInput(((data as any).tags || []).join(', '));
      setImages(data.images || []);
      setVideoUrl(data.video_url || '');
      setVideoThumbnail((data as any).video_thumbnail || '');

      // Load location
      if (data.location_id) {
        loadProductLocation(data.location_id);
      }

      setFetching(false);
    };

    fetchProduct();
  }, [productId]);

  const loadProductLocation = async (locationId: string) => {
    try {
      const { data: sector } = await supabase
        .from('locations')
        .select('id, parent_id, name')
        .eq('id', locationId)
        .single();
      
      if (sector) {
        const { data: district } = await supabase
          .from('locations')
          .select('id, parent_id, name')
          .eq('id', sector.parent_id)
          .single();
        
        if (district) {
          const { data: province } = await supabase
            .from('locations')
            .select('id, name')
            .eq('id', district.parent_id)
            .single();
          
          if (province) {
            setSelectedProvince(province.id);
            setTimeout(() => {
              setSelectedDistrict(district.id);
              setTimeout(() => {
                setSelectedSector(sector.id);
              }, 100);
            }, 100);
          }
        }
      }
    } catch (err) {
      console.error('Error loading location:', err);
    }
  };

  const isRentalCategory = formData.category?.toLowerCase().includes('rent') || 
    formData.category?.toLowerCase().includes('lent') ||
    formData.product_type === 'rental';

  const { upload, isUploading, processingStage } = useProcessedUpload({ folder: 'products', addWatermark: true });

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
    try {
      const processed = await processVideo(file);
      const thumbFile = new File([processed.thumbnailBlob], `video-thumb-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const thumbResult = await uploadToCloudinary(thumbFile, 'product-video-thumbs');
      const fd = new FormData();
      fd.append('file', processed.blob);
      fd.append('upload_preset', 'smart_market_upload');
      fd.append('folder', 'smart_market/product-videos');
      const res = await fetch('https://api.cloudinary.com/v1_1/ddwrviw3v/video/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Video upload failed');
      const data = await res.json();
      setVideoUrl(data.secure_url);
      setVideoThumbnail(optimizeCloudinaryUrl(thumbResult.secure_url));
      toast({ title: '✅ Video uploaded', description: `${processed.duration.toFixed(1)}s` });
    } catch (err: any) {
      toast({ title: 'Video upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setVideoUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const getLocationString = () => {
    const parts = [];
    const sector = sectors.find(s => s.id === selectedSector);
    const district = districts.find(d => d.id === selectedDistrict);
    const province = provinces.find(p => p.id === selectedProvince);
    
    if (sector) parts.push(sector.name);
    if (district) parts.push(district.name);
    if (province) parts.push(province.name);
    
    return parts.join(', ') || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !productId) {
      toast({ title: "Error occurred", variant: "destructive" });
      return;
    }

    if (images.length === 0) {
      toast({ title: "Please add at least one image", variant: "destructive" });
      return;
    }

    if (!formData.title) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }

    // Price is only required if not negotiable
    if (!formData.is_negotiable && !formData.price) {
      toast({ title: "Price is required when not negotiable", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const locationString = getLocationString();
      
      const productData: any = {
        title: formData.title,
        description: formData.description,
        price: formData.price ? parseFloat(formData.price) : 0,
        quantity: parseInt(formData.quantity) || 1,
        minimum_quantity: parseInt(formData.minimum_quantity) || 1,
        unlimited_quantity: formData.unlimited_quantity,
        category: formData.category || null,
        product_type: isRentalCategory ? 'rental' : formData.product_type,
        is_negotiable: formData.is_negotiable,
        images: images,
        video_url: videoUrl || null,
        video_thumbnail: videoThumbnail || null,
        tags: tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 20),
        location: locationString,
        location_id: selectedSector || null,
        admin_posted: formData.admin_posted,
        admin_phone: formData.admin_phone || null,
        admin_shop_name: formData.admin_shop_name || null,
        admin_location: locationString,
        show_connect_button: !formData.admin_posted,
        sponsored: formData.sponsored,
        last_edited_by: user.id,
        contact_whatsapp: formData.contact_whatsapp || formData.admin_phone || null,
        contact_call: formData.contact_call || formData.admin_phone || null,
      };

      if (isRentalCategory || formData.rental_unit) {
        productData.rental_fee = formData.rental_fee ? parseFloat(formData.rental_fee) : parseFloat(formData.price);
        productData.rental_unit = formData.rental_unit;
        productData.rental_status = 'available';
      }

      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', productId);
      
      if (error) throw error;
      toast({ title: "Product updated successfully! ✨" });
      navigate('/admin/products');
    } catch (err: any) {
      toast({ 
        title: "Failed to save product", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  if (adminLoading || fetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate('/admin/products')}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg">Edit Product</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Image Upload */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            Product Images (Max 2) *
            <span className="text-xs text-primary flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI Smart Background
            </span>
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                <img src={img} alt="" className="w-full h-full object-cover" />
                {processingImages.has(idx) && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-white mx-auto mb-1" />
                      <p className="text-white text-xs">{processingStage || 'AI Processing...'}</p>
                    </div>
                  </div>
                )}
                {!processingImages.has(idx) && (
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
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

        {/* Video Upload (max 30s, auto thumbnail) */}
        <div className="space-y-2">
          <Label>Product Video (Optional, max 30s)</Label>
          {videoUrl ? (
            <div className="relative rounded-xl overflow-hidden bg-muted">
              <video
                src={videoUrl}
                controls
                preload="none"
                playsInline
                poster={videoThumbnail || undefined}
                className="w-full aspect-video"
              />
              <button
                type="button"
                onClick={() => { setVideoUrl(''); setVideoThumbnail(''); }}
                className="absolute top-2 right-2 w-8 h-8 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <label className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:bg-muted/50 transition-colors ${videoUploading ? 'opacity-60 pointer-events-none' : ''}`}>
              {videoUploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Video className="h-8 w-8 text-muted-foreground" />}
              <div>
                <p className="font-medium">{videoUploading ? 'Processing video...' : 'Upload Video'}</p>
                <p className="text-sm text-muted-foreground">Auto-compressed & thumbnail generated</p>
              </div>
              <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" disabled={videoUploading} />
            </label>
          )}
        </div>

        {/* Product Name with AI */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="title">Product Name *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 rounded-lg border-primary/30 text-primary hover:bg-primary/5"
              disabled={!formData.title || formData.title.length < 3 || aiLoading}
              onClick={generateAi}
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              AI Optimize
            </Button>
          </div>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter product name"
            required
            className="rounded-xl"
          />
        </div>

        {/* Negotiable Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
          <div>
            <Label htmlFor="negotiable">Price is Negotiable</Label>
            <p className="text-sm text-muted-foreground">
              {formData.is_negotiable 
                ? "Price field becomes optional" 
                : "Buyers will see a fixed price"}
            </p>
          </div>
          <Switch
            id="negotiable"
            checked={formData.is_negotiable}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_negotiable: checked }))}
          />
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
              className="rounded-xl"
            />
            {formData.is_negotiable && !formData.price && (
              <p className="text-xs text-muted-foreground">
                Will show "Negotiable" instead of price
              </p>
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
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_qty">Min Order Qty</Label>
            <Input
              id="min_qty"
              type="number"
              value={formData.minimum_quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, minimum_quantity: e.target.value }))}
              placeholder="1"
              min="1"
              className="rounded-xl"
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch
              checked={formData.unlimited_quantity}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, unlimited_quantity: checked }))}
            />
            <Label>Unlimited quantity</Label>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input
            id="tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. phone, samsung, new"
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">Improves search discovery</p>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={categories.find(c => c.slug === formData.category)?.slug ?? categories.find(c => formData.category && (c.slug.startsWith(formData.category) || c.name.toLowerCase() === formData.category.toLowerCase()))?.slug ?? formData.category}
            onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-card max-h-[300px]">
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.slug}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product Type */}
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
              <SelectItem value="rental">Equipment for Rent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Rental Fields */}
        {(isRentalCategory || formData.product_type === 'rental') && (
          <div className="bg-primary/5 rounded-2xl p-4 space-y-4 border border-primary/20">
            <h3 className="font-semibold flex items-center gap-2 text-primary">
              🔧 Rental Fee Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rental Fee (RWF)</Label>
                <Input
                  type="number"
                  value={formData.rental_fee || formData.price}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    rental_fee: e.target.value,
                  }))}
                  placeholder="50000"
                  className="rounded-xl"
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
                    <SelectValue placeholder="Select rate" />
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
          </div>
        )}

        {/* Admin Toggles */}
        <div className="space-y-4">

          <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div>
              <Label htmlFor="admin_posted" className="text-amber-800">Admin Posted</Label>
              <p className="text-sm text-amber-600">Official p4no product</p>
            </div>
            <Switch
              id="admin_posted"
              checked={formData.admin_posted}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, admin_posted: checked }))}
            />
          </div>

          {formData.admin_posted && (
            <div className="space-y-2 p-4 rounded-xl border border-amber-300/40 bg-amber-50/40">
              <Label>Custom Virtual Shop Name</Label>
              <Input
                value={formData.admin_shop_name}
                onChange={(e) => setFormData(prev => ({ ...prev, admin_shop_name: e.target.value }))}
                placeholder="e.g. Kigali Fresh Market"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Shown only on this product. Won't appear in featured shops.</p>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border border-purple-200">
            <div>
              <Label htmlFor="sponsored" className="text-purple-800">Featured / Sponsored</Label>
              <p className="text-sm text-purple-600">Highlight at top of listings</p>
            </div>
            <Switch
              id="sponsored"
              checked={formData.sponsored}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sponsored: checked }))}
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="description">Description *</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 rounded-lg border-primary/30 text-primary hover:bg-primary/5"
              disabled={!formData.title || formData.title.length < 3 || aiLoading}
              onClick={generateAi}
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              AI Generate
            </Button>
          </div>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe your product in detail..."
            rows={6}
            required
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">{formData.description.length} characters</p>
        </div>

        {/* Location Selection */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-xl border">
          <Label className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Location
          </Label>
          <Select value={selectedProvince} onValueChange={setSelectedProvince}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select Province" />
            </SelectTrigger>
            <SelectContent className="bg-card">
              {provinces.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedProvince && (
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select District" />
              </SelectTrigger>
              <SelectContent className="bg-card">
                {districts.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {selectedDistrict && (
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select Sector" />
              </SelectTrigger>
              <SelectContent className="bg-card">
                {sectors.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Contact Numbers */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Call Number
            </Label>
            <Input
              value={formData.contact_call}
              onChange={(e) => setFormData(prev => ({ ...prev, contact_call: e.target.value }))}
              placeholder="+250..."
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input
              value={formData.contact_whatsapp}
              onChange={(e) => setFormData(prev => ({ ...prev, contact_whatsapp: e.target.value }))}
              placeholder="+250..."
              className="rounded-xl"
            />
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          type="submit" 
          disabled={loading}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Save Changes
            </>
          )}
        </Button>
      </form>
    </div>
  );
};

export default AdminProductEdit;
