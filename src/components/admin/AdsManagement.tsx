import { useState, useEffect } from "react";
import { 
  Megaphone, Plus, Image, Type, Link, Calendar, Users, 
  Trash2, Edit, MoreVertical, Eye, Clock, Store, User,
  MapPin, Upload, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  type: string;
  image_url: string | null;
  link: string | null;
  bg_color: string | null;
  text_color: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean | null;
  priority: number | null;
  created_at: string | null;
  target_audience: string | null;
  location_id: string | null;
  font_size: string | null;
}

interface Location {
  id: string;
  name: string;
  type: string;
}

const AdsManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'text',
    image_url: '',
    link: '',
    bg_color: '#f97316',
    text_color: '#ffffff',
    start_date: '',
    end_date: '',
    target_audience: 'all',
    location_id: '',
    font_size: 'medium',
  });

  const fetchAds = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setAds(data);
    if (error) console.error('Failed to fetch ads:', error);
    setLoading(false);
  };

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('id, name, type')
      .order('name');
    if (data) setLocations(data);
  };

  useEffect(() => {
    fetchAds();
    fetchLocations();
  }, []);

  const { upload: cloudinaryUpload, isUploading: cloudinaryUploading } = useCloudinaryUpload({ folder: 'ads' });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await cloudinaryUpload(file);
      if (url) {
        setFormData(prev => ({ ...prev, image_url: url }));
      }
    } catch (err: any) {
      toast({ 
        title: "Upload failed", 
        description: err.message,
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const now = new Date().toISOString();
      const adData = {
        title: formData.title,
        description: formData.description || null,
        type: formData.type,
        image_url: formData.image_url || null,
        link: formData.link || null,
        bg_color: formData.bg_color,
        text_color: formData.text_color,
        font_size: formData.font_size,
        start_date: formData.start_date || now,
        end_date: formData.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
        target_audience: formData.target_audience || 'all',
        location_id: formData.location_id || null,
        created_by: user?.id || null,
      };

      if (editingAd) {
        const { error } = await supabase
          .from('ads')
          .update(adData)
          .eq('id', editingAd.id);

        if (error) {
          console.error('Ad update error:', error);
          toast({ 
            title: "Failed to update ad", 
            description: error.message,
            variant: "destructive" 
          });
        } else {
          toast({ title: "Ad updated!" });
          fetchAds();
          resetForm();
        }
      } else {
        const { error } = await supabase
          .from('ads')
          .insert(adData);

        if (error) {
          console.error('Ad creation error:', error);
          toast({ 
            title: "Failed to create ad", 
            description: error.message,
            variant: "destructive" 
          });
        } else {
          toast({ title: "Ad created!" });
          fetchAds();
          resetForm();
        }
      }
    } catch (err: any) {
      console.error('Ad submission error:', err);
      toast({ 
        title: "Error", 
        description: err.message || "An unexpected error occurred",
        variant: "destructive" 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'text',
      image_url: '',
      link: '',
      bg_color: '#f97316',
      text_color: '#ffffff',
      start_date: '',
      end_date: '',
      target_audience: 'all',
      location_id: '',
      font_size: 'medium',
    });
    setEditingAd(null);
    setShowAddDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ad?')) return;
    
    const { error } = await supabase.from('ads').delete().eq('id', id);

    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ad deleted!" });
      fetchAds();
    }
  };

  const toggleAdStatus = async (id: string, currentStatus: boolean | null) => {
    const { error } = await supabase
      .from('ads')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (!error) {
      toast({ title: currentStatus ? "Ad deactivated" : "Ad activated" });
      fetchAds();
    }
  };

  const openEditDialog = (ad: Ad) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description || '',
      type: ad.type,
      image_url: ad.image_url || '',
      link: ad.link || '',
      bg_color: ad.bg_color || '#f97316',
      text_color: ad.text_color || '#ffffff',
      start_date: ad.start_date,
      end_date: ad.end_date,
      target_audience: ad.target_audience || 'all',
      location_id: ad.location_id || '',
      font_size: ad.font_size || 'medium',
    });
    setShowAddDialog(true);
  };

  const activeAds = ads.filter(a => a.is_active);
  const getLocationName = (id: string | null) => {
    if (!id) return 'All Locations';
    return locations.find(l => l.id === id)?.name || 'Unknown';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Smart Ads</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage promotional ads with location targeting
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={(open) => {
          if (!open) resetForm();
          setShowAddDialog(open);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Create Ad
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-popover max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAd ? 'Edit Ad' : 'Create New Ad'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Title *</Label>
                <Input
                  placeholder="Ad title..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Description</Label>
                <Textarea
                  placeholder="Ad description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="text">Text Only</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="banner">Banner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Target Audience</Label>
                  <Select
                    value={formData.target_audience}
                    onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="seller">Sellers Only</SelectItem>
                      <SelectItem value="buyer">Buyers Only</SelectItem>
                      <SelectItem value="seller_dashboard">Seller Dashboard Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Location Targeting */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Target Location (Optional)</Label>
                <Select
                  value={formData.location_id || 'all'}
                  onValueChange={(value) => setFormData({ ...formData, location_id: value === 'all' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover max-h-60">
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Link URL</Label>
                <Input
                  placeholder="https://..."
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                />
              </div>
              
              {/* Image Upload */}
              {formData.type !== 'text' && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Ad Image</Label>
                  <div className="space-y-3">
                    {formData.image_url && (
                      <div className="relative">
                        <img 
                          src={formData.image_url} 
                          alt="Ad preview" 
                          className="w-full h-40 object-cover rounded-xl"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={() => setFormData({ ...formData, image_url: '' })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <label className="flex-1">
                        <div className={cn(
                          "flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                          uploading ? "bg-muted" : "hover:border-primary hover:bg-primary/5"
                        )}>
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {uploading ? 'Uploading...' : 'Upload Image'}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                    <Input
                      placeholder="Or paste image URL..."
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.bg_color}
                      onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.bg_color}
                      onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.text_color}
                      onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Font Size</Label>
                <Select
                  value={formData.font_size}
                  onValueChange={(value) => setFormData({ ...formData, font_size: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date ? formData.start_date.split('T')[0] : ''}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">End Date</Label>
                  <Input
                    type="date"
                    value={formData.end_date ? formData.end_date.split('T')[0] : ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Preview */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Preview</Label>
                <div 
                  className="rounded-xl p-4 text-center overflow-hidden"
                  style={{ backgroundColor: formData.bg_color, color: formData.text_color }}
                >
                  {formData.image_url && formData.type !== 'text' && (
                    <img 
                      src={formData.image_url} 
                      alt="Preview" 
                      className={cn(
                        "w-full object-cover rounded-lg mb-3",
                        formData.type === 'banner' ? "h-48" : "h-32"
                      )}
                    />
                  )}
                  <p className={cn(
                    "font-semibold",
                    formData.font_size === 'small' && 'text-sm',
                    formData.font_size === 'medium' && 'text-base',
                    formData.font_size === 'large' && 'text-xl'
                  )}>
                    {formData.title || 'Your Ad Title'}
                  </p>
                  {formData.description && (
                    <p className="text-sm opacity-80 mt-1">{formData.description}</p>
                  )}
                </div>
              </div>

              <Button onClick={handleSubmit} className="w-full" disabled={uploading || submitting}>
                {submitting ? 'Saving...' : editingAd ? 'Update Ad' : 'Create Ad'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Megaphone className="h-4 w-4" />
            <span className="text-xs font-medium">Total Ads</span>
          </div>
          <p className="text-2xl font-bold">{ads.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <Eye className="h-4 w-4" />
            <span className="text-xs font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold">{activeAds.length}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <MapPin className="h-4 w-4" />
            <span className="text-xs font-medium">Targeted</span>
          </div>
          <p className="text-2xl font-bold">{ads.filter(a => a.location_id).length}</p>
        </div>
      </div>

      {/* Ads List */}
      <div className="bg-card rounded-2xl border overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-transparent">
          <h3 className="font-semibold">All Ads</h3>
        </div>
        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-20" />
              </div>
            ))
          ) : ads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No ads created yet</p>
            </div>
          ) : (
          ads.map(ad => (
              <div key={ad.id} className="p-4 hover:bg-accent transition-colors">
                <div className="flex items-start gap-4">
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: ad.bg_color || '#f97316' }}
                  >
                    {ad.type !== 'text' && ad.image_url ? (
                      <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                    ) : (
                      <Type className="h-6 w-6" style={{ color: ad.text_color || '#fff' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold">{ad.title}</p>
                      <Badge className={cn(
                        "text-xs",
                        ad.is_active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"
                      )}>
                        {ad.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {ad.target_audience !== 'all' && (
                        <Badge variant="outline" className="text-xs capitalize">
                          <User className="h-3 w-3 mr-1" />
                          {ad.target_audience}s
                        </Badge>
                      )}
                    </div>
                    {ad.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{ad.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                      <span className="flex items-center gap-1 capitalize">
                        {ad.type === 'image' ? <Image className="h-3 w-3" /> : <Type className="h-3 w-3" />}
                        {ad.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(ad.end_date), 'MMM d')}
                      </span>
                      {ad.location_id && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {getLocationName(ad.location_id)}
                        </span>
                      )}
                      {ad.link && (
                        <span className="flex items-center gap-1">
                          <Link className="h-3 w-3" />
                          Has link
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => toggleAdStatus(ad.id, ad.is_active)}>
                        <Eye className="h-4 w-4 mr-2" />
                        {ad.is_active ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(ad)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(ad.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdsManagement;
