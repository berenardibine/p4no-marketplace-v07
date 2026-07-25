import { useState, useEffect } from "react";
import { 
  Tag, Plus, Edit, Trash2, MoreVertical, Search, 
  ShoppingBag, Building, Tractor, Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  type: string | null;
  created_at: string | null;
  productCount?: number;
}

const typeOptions = [
  { value: 'general', label: 'Home / General', icon: Home },
  { value: 'asset', label: 'Assets', icon: Building },
  { value: 'agriculture', label: 'Agriculture', icon: Tractor },
  { value: 'rent', label: 'Equipment for Rent', icon: ShoppingBag },
];

const CategoriesManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    icon: '',
    type: 'general',
    isActive: true,
    seo_title: '',
    seo_description: '',
    seo_image: '',
  });

  const fetchCategories = async () => {
    setLoading(true);
    const { data: categoriesData, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (categoriesData) {
      // Get product counts for each category
      const categoriesWithCounts = await Promise.all(
        categoriesData.map(async (cat) => {
          const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('category', cat.slug);
          return { ...cat, productCount: count || 0 };
        })
      );
      setCategories(categoriesWithCounts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Category name is required", variant: "destructive" });
      return;
    }

    const slug = formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-');

    const categoryData = {
      name: formData.name,
      slug,
      icon: formData.icon || null,
      type: formData.type,
      seo_title: formData.seo_title || null,
      seo_description: formData.seo_description || null,
      seo_image: formData.seo_image || null,
    };

    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', editingCategory.id);

      if (error) {
        toast({ title: "Failed to update category", variant: "destructive" });
      } else {
        toast({ title: "Category updated!" });
        fetchCategories();
      }
    } else {
      const { error } = await supabase
        .from('categories')
        .insert(categoryData);

      if (error) {
        toast({ title: "Failed to create category", variant: "destructive" });
      } else {
        toast({ title: "Category created!" });
        fetchCategories();
      }
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      icon: '',
      type: 'general',
      isActive: true,
      seo_title: '',
      seo_description: '',
      seo_image: '',
    });
    setEditingCategory(null);
    setShowDialog(false);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      icon: category.icon || '',
      type: category.type || 'general',
      isActive: true,
      seo_title: (category as any).seo_title || '',
      seo_description: (category as any).seo_description || '',
      seo_image: (category as any).seo_image || '',
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? Products in this category will need to be reassigned.')) return;
    
    const { error } = await supabase.from('categories').delete().eq('id', id);

    if (error) {
      toast({ title: "Failed to delete category", variant: "destructive" });
    } else {
      toast({ title: "Category deleted!" });
      fetchCategories();
    }
  };

  const filteredCategories = categories.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || cat.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string | null) => {
    const found = typeOptions.find(t => t.value === type);
    return found?.icon || ShoppingBag;
  };

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case 'asset': return 'bg-blue-100 text-blue-700';
      case 'agriculture': return 'bg-green-100 text-green-700';
      case 'rent': return 'bg-purple-100 text-purple-700';
      default: return 'bg-orange-100 text-orange-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Product Categories</h3>
          <p className="text-sm text-muted-foreground">
            Manage categories for products across all sections
          </p>
        </div>
        <Button 
          onClick={() => setShowDialog(true)}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by section" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">All Sections</SelectItem>
            {typeOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {typeOptions.map(opt => {
          const count = categories.filter(c => c.type === opt.value).length;
          const Icon = opt.icon;
          return (
            <div key={opt.value} className="bg-white rounded-xl p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">{opt.label}</span>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-white">
          <h3 className="font-semibold">All Categories ({filteredCategories.length})</h3>
        </div>
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="p-4">
                <Skeleton className="h-16" />
              </div>
            ))
          ) : filteredCategories.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No categories found</p>
            </div>
          ) : (
            filteredCategories.map(cat => {
              const TypeIcon = getTypeIcon(cat.type);
              return (
                <div key={cat.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      getTypeColor(cat.type)
                    )}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{cat.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {cat.slug}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="capitalize">{cat.type || 'general'}</span>
                        <span>•</span>
                        <span>{cat.productCount} products</span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white">
                        <DropdownMenuItem onClick={() => handleEdit(cat)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(cat.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        if (!open) resetForm();
        setShowDialog(open);
      }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Category Name *</label>
              <Input
                placeholder="e.g., Electronics"
                value={formData.name}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  name: e.target.value,
                  slug: e.target.value.toLowerCase().replace(/\s+/g, '-')
                })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Slug</label>
              <Input
                placeholder="e.g., electronics"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL-friendly identifier. Auto-generated from name.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Display Section *</label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {typeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Icon (emoji or icon name)</label>
              <Input
                placeholder="e.g., 📱 or laptop"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">SEO Title (for search engines)</label>
              <Input
                placeholder="Custom title for Google & social"
                value={formData.seo_title}
                onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">{formData.seo_title.length}/60 chars</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">SEO Description</label>
              <Textarea
                placeholder="Description for search engines & social previews"
                value={formData.seo_description}
                onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">{formData.seo_description.length}/160 chars</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">SEO Image URL</label>
              <Input
                placeholder="Image URL for social preview"
                value={formData.seo_image}
                onChange={(e) => setFormData({ ...formData, seo_image: e.target.value })}
              />
              {formData.seo_image && <img src={formData.seo_image} alt="Preview" className="mt-2 h-16 rounded-lg object-cover" />}
            </div>
            <Button onClick={handleSubmit} className="w-full">
              {editingCategory ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoriesManagement;