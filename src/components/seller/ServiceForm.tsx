import { useState } from 'react';
import { ArrowLeft, X, Plus, Loader2, Video, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useProcessedUpload } from '@/hooks/useProcessedUpload';
import { useServiceCategories } from '@/hooks/useServiceCategories';
import { validateImageFile, uploadToCloudinary, optimizeCloudinaryUrl } from '@/lib/cloudinary';
import { processVideo, VIDEO_LIMITS } from '@/lib/videoProcessor';

interface Props {
  service?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const ServiceForm = ({ service, onSuccess, onCancel }: Props) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { categories } = useServiceCategories();
  const { upload, isUploading } = useProcessedUpload({ folder: 'services', addWatermark: false });
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>(service?.images || []);
  const [videoUrl, setVideoUrl] = useState(service?.video_url || '');
  const [videoThumbnail, setVideoThumbnail] = useState(service?.video_thumbnail || '');
  const [videoUploading, setVideoUploading] = useState(false);
  const [portfolioInput, setPortfolioInput] = useState((service?.portfolio_links || []).join(', '));
  const [form, setForm] = useState({
    title: service?.title || '',
    category: service?.category || '',
    short_description: service?.short_description || '',
    description: service?.description || '',
    pricing_type: service?.pricing_type || 'fixed',
    price: service?.price?.toString() || '',
    location: service?.location || (profile as any)?.location || '',
    whatsapp_number: service?.whatsapp_number || profile?.whatsapp_number || '',
    phone_number: service?.phone_number || (profile as any)?.call_number || profile?.phone_number || '',
    years_experience: service?.years_experience?.toString() || '0',
    availability: service?.availability || '',
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (images.length + files.length > 6) {
      toast({ title: 'Maximum 6 images', variant: 'destructive' });
      return;
    }
    for (const file of Array.from(files)) {
      const err = validateImageFile(file);
      if (err) { toast({ title: err, variant: 'destructive' }); continue; }
      const url = await upload(file);
      if (url) setImages(prev => [...prev, url]);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploading(true);
    try {
      const processed = await processVideo(file);
      const thumbFile = new File([processed.thumbnailBlob], `service-thumb-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const thumb = await uploadToCloudinary(thumbFile, 'service-video-thumbs');
      const fd = new FormData();
      fd.append('file', processed.blob);
      fd.append('upload_preset', 'smart_market_upload');
      fd.append('folder', 'smart_market/service-videos');
      const res = await fetch('https://api.cloudinary.com/v1_1/ddwrviw3v/video/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Video upload failed');
      const data = await res.json();
      setVideoUrl(data.secure_url);
      setVideoThumbnail(optimizeCloudinaryUrl(thumb.secure_url));
      toast({ title: '✅ Video uploaded', description: `${processed.duration.toFixed(1)}s` });
    } catch (err: any) {
      toast({ title: 'Video upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setVideoUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (i: number) => setImages(prev => prev.filter((_, x) => x !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (!service?.id) {
      const { data: setting } = await supabase
        .from('admin_settings').select('value').eq('key', 'services_require_verification').maybeSingle();
      let requireVerification = false;
      if (setting) {
        let v: any = setting.value;
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch {} }
        requireVerification = v === true;
      }
      if (requireVerification && !(profile as any).identity_verified) {
        toast({ title: 'Verification required', description: 'Verify your identity before posting services.', variant: 'destructive' });
        return;
      }
    }

    if (images.length === 0 && !videoUrl) {
      toast({ title: 'Add at least one image or video', variant: 'destructive' });
      return;
    }
    if ((form.description || '').trim().length < 50) {
      toast({ title: 'Description too short', description: 'Min 50 characters.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        seller_id: user.id,
        title: form.title,
        category: form.category || null,
        short_description: form.short_description || null,
        description: form.description,
        pricing_type: form.pricing_type,
        price: form.price ? parseFloat(form.price) : 0,
        location: form.location || null,
        country: profile.country || null,
        currency_code: profile.currency_code || 'RWF',
        currency_symbol: profile.currency_symbol || 'R₣',
        whatsapp_number: form.whatsapp_number || null,
        phone_number: form.phone_number || null,
        images,
        video_url: videoUrl || null,
        video_thumbnail: videoThumbnail || null,
        years_experience: parseInt(form.years_experience) || 0,
        availability: form.availability || null,
        portfolio_links: portfolioInput.split(',').map(s => s.trim()).filter(Boolean),
        status: 'active',
      };

      if (service?.id) {
        const { error } = await supabase.from('services').update(payload).eq('id', service.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Failed to save service', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg">{service ? 'Edit Service' : 'Add New Service'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Images */}
        <div className="space-y-3">
          <Label>Service Images (max 6)</Label>
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {images.length < 6 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-primary/50 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5">
                {isUploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <><Plus className="h-6 w-6 text-primary/50 mb-1" /><span className="text-xs text-muted-foreground">Add</span></>}
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* Video */}
        <div className="space-y-2">
          <Label>Promo Video (optional, max {VIDEO_LIMITS.MAX_DURATION}s)</Label>
          {videoUrl ? (
            <div className="relative rounded-xl overflow-hidden bg-muted aspect-video">
              <video src={videoUrl} poster={videoThumbnail} className="w-full h-full object-cover" controls />
              <button type="button" onClick={() => { setVideoUrl(''); setVideoThumbnail(''); }} className="absolute top-2 right-2 w-8 h-8 bg-destructive rounded-full flex items-center justify-center text-destructive-foreground">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-20 rounded-xl border-2 border-dashed border-primary/50 cursor-pointer hover:bg-primary/5">
              {videoUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <><Video className="h-5 w-5 text-primary" /><span className="text-sm font-medium">Upload short video</span></>}
              <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" disabled={videoUploading} />
            </label>
          )}
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label>Service Title *</Label>
          <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Professional Home Cleaning" required />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Category *</Label>
          <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent className="bg-card">
              {categories.map(c => (<SelectItem key={c.id} value={c.slug}>{c.icon} {c.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        {/* Short description */}
        <div className="space-y-2">
          <Label>Short tagline</Label>
          <Input value={form.short_description} onChange={e => setForm(p => ({ ...p, short_description: e.target.value }))} placeholder="One-line pitch" maxLength={140} />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label>Detailed Description *</Label>
          <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe your service, what's included, your approach..." rows={6} required />
          <p className="text-xs text-muted-foreground">{form.description.length} chars (min 50)</p>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Pricing Type</Label>
            <Select value={form.pricing_type} onValueChange={v => setForm(p => ({ ...p, pricing_type: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="negotiable">Negotiable</SelectItem>
                <SelectItem value="starting_from">Starting from</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Price {form.pricing_type !== 'negotiable' && '*'}</Label>
            <Input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0" required={form.pricing_type !== 'negotiable'} />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label>Service Location</Label>
          <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Kigali, Rwanda" />
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>WhatsApp *</Label>
            <Input value={form.whatsapp_number} onChange={e => setForm(p => ({ ...p, whatsapp_number: e.target.value }))} placeholder="+250..." required />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone_number} onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} placeholder="+250..." />
          </div>
        </div>

        {/* Experience & availability */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Years of experience</Label>
            <Input type="number" value={form.years_experience} onChange={e => setForm(p => ({ ...p, years_experience: e.target.value }))} placeholder="0" min="0" />
          </div>
          <div className="space-y-2">
            <Label>Availability</Label>
            <Input value={form.availability} onChange={e => setForm(p => ({ ...p, availability: e.target.value }))} placeholder="e.g. Mon-Sat, 8am-6pm" />
          </div>
        </div>

        {/* Portfolio */}
        <div className="space-y-2">
          <Label>Portfolio links (comma-separated)</Label>
          <Textarea value={portfolioInput} onChange={e => setPortfolioInput(e.target.value)} placeholder="https://..., https://..." rows={2} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-xl">Cancel</Button>
          <Button type="submit" disabled={loading} className="flex-1 rounded-xl gap-2 bg-gradient-to-r from-primary to-primary/80">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {service ? 'Update' : 'Publish'} Service
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ServiceForm;
