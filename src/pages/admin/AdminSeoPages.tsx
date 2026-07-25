import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, FileText, Edit, Eye, Save, Code, Type, Globe, 
  Package, FolderTree, Search, RefreshCw, Loader2, ExternalLink,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SitePage {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  seo_title: string | null;
  seo_image: string | null;
  content: string;
  is_published: boolean;
  updated_at: string | null;
}

interface ProductSeo {
  id: string;
  title: string;
  slug: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_image: string | null;
  images: string[];
  price: number;
}

interface CategorySeo {
  id: string;
  name: string;
  slug: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_image: string | null;
  icon: string | null;
}

const AdminSeoPages = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Pages state
  const [pages, setPages] = useState<SitePage[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [editingPage, setEditingPage] = useState<SitePage | null>(null);
  const [showPageEditor, setShowPageEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(true);
  const [savingPage, setSavingPage] = useState(false);
  const [pageForm, setPageForm] = useState({ title: '', meta_description: '', seo_title: '', seo_image: '', content: '', is_published: true });

  // Products SEO state
  const [products, setProducts] = useState<ProductSeo[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<ProductSeo | null>(null);
  const [showProductEditor, setShowProductEditor] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState({ seo_title: '', seo_description: '', seo_image: '' });

  // Categories SEO state
  const [categories, setCategories] = useState<CategorySeo[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [editingCategory, setEditingCategory] = useState<CategorySeo | null>(null);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ seo_title: '', seo_description: '', seo_image: '' });

  // Sitemap state
  const [sitemapLoading, setSitemapLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchPages();
      fetchProducts();
      fetchCategories();
    }
  }, [isAdmin]);

  const fetchPages = async () => {
    setLoadingPages(true);
    const { data } = await supabase.from('site_pages').select('*').order('created_at');
    if (data) setPages(data as SitePage[]);
    setLoadingPages(false);
  };

  const openPageEditor = (page: SitePage) => {
    setEditingPage(page);
    setPageForm({
      title: page.title,
      meta_description: page.meta_description || '',
      seo_title: page.seo_title || '',
      seo_image: page.seo_image || '',
      content: page.content,
      is_published: page.is_published,
    });
    setShowPageEditor(true);
    setShowPreview(false);
  };

  const handleSavePage = async () => {
    if (!editingPage) return;
    setSavingPage(true);
    const { error } = await supabase.from('site_pages').update({
      title: pageForm.title,
      meta_description: pageForm.meta_description,
      seo_title: pageForm.seo_title || null,
      seo_image: pageForm.seo_image || null,
      content: pageForm.content,
      is_published: pageForm.is_published,
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    }).eq('id', editingPage.id);
    if (error) toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    else { toast({ title: "Page saved!" }); fetchPages(); setShowPageEditor(false); }
    setSavingPage(false);
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    const { data } = await supabase.from('products')
      .select('id, title, slug, seo_title, seo_description, seo_image, images, price')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (data) setProducts(data as ProductSeo[]);
    setLoadingProducts(false);
  };

  const openProductEditor = (p: ProductSeo) => {
    setEditingProduct(p);
    setProductForm({
      seo_title: p.seo_title || p.title,
      seo_description: p.seo_description || '',
      seo_image: p.seo_image || p.images?.[0] || '',
    });
    setShowProductEditor(true);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    setSavingProduct(true);
    const { error } = await supabase.from('products').update({
      seo_title: productForm.seo_title,
      seo_description: productForm.seo_description,
      seo_image: productForm.seo_image,
    }).eq('id', editingProduct.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Product SEO updated!" }); fetchProducts(); setShowProductEditor(false); }
    setSavingProduct(false);
  };

  const fetchCategories = async () => {
    setLoadingCategories(true);
    const { data } = await supabase.from('categories').select('id, name, slug, seo_title, seo_description, seo_image, icon').order('name');
    if (data) setCategories(data as CategorySeo[]);
    setLoadingCategories(false);
  };

  const openCategoryEditor = (c: CategorySeo) => {
    setEditingCategory(c);
    setCategoryForm({
      seo_title: c.seo_title || '',
      seo_description: c.seo_description || '',
      seo_image: c.seo_image || '',
    });
    setShowCategoryEditor(true);
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) return;
    setSavingCategory(true);
    const { error } = await supabase.from('categories').update({
      seo_title: categoryForm.seo_title || null,
      seo_description: categoryForm.seo_description || null,
      seo_image: categoryForm.seo_image || null,
    }).eq('id', editingCategory.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Category SEO updated!" }); fetchCategories(); setShowCategoryEditor(false); }
    setSavingCategory(false);
  };

  const [generatingSitemap, setGeneratingSitemap] = useState(false);

  const handleGenerateSitemap = async () => {
    setGeneratingSitemap(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-sitemap');
      if (error) throw error;
      toast({ title: "Sitemap generated successfully!", description: "The sitemap has been refreshed with latest data." });
    } catch (err: any) {
      toast({ title: "Failed to generate sitemap", description: err.message, variant: "destructive" });
    }
    setGeneratingSitemap(false);
  };

  const handlePingSitemap = async () => {
    setSitemapLoading(true);
    try {
      window.open('https://www.google.com/ping?sitemap=https://p4no-marketplace.vercel.app/sitemap.xml', '_blank');
      toast({ title: "Sitemap ping sent to Google!" });
    } catch {
      toast({ title: "Failed to ping", variant: "destructive" });
    }
    setSitemapLoading(false);
  };

  const filteredProducts = products.filter(p => 
    p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.slug && p.slug.toLowerCase().includes(productSearch.toLowerCase()))
  );

  if (adminLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!isAdmin) { navigate('/'); return null; }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/admin')} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-semibold text-lg">SEO Manager</h1>
            <p className="text-xs text-muted-foreground">Products, Categories, Pages & Sitemap</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <Tabs defaultValue="products">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="products" className="text-xs gap-1"><Package className="h-3.5 w-3.5" />Products</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs gap-1"><FolderTree className="h-3.5 w-3.5" />Categories</TabsTrigger>
            <TabsTrigger value="pages" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Pages</TabsTrigger>
            <TabsTrigger value="sitemap" className="text-xs gap-1"><Globe className="h-3.5 w-3.5" />Sitemap</TabsTrigger>
          </TabsList>

          {/* Products SEO Tab */}
          <TabsContent value="products" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-9" />
            </div>
            {loadingProducts ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            ) : (
              filteredProducts.map(p => (
                <div key={p.id} className="bg-card rounded-xl border p-3 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                      {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="h-6 w-6 m-3 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{p.title}</h3>
                      <p className="text-xs text-muted-foreground truncate">/{p.slug || 'no-slug'}</p>
                      <div className="flex gap-1 mt-1">
                        {p.seo_title && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Title ✓</Badge>}
                        {p.seo_description && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Desc ✓</Badge>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openProductEditor(p)}><Edit className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Categories SEO Tab */}
          <TabsContent value="categories" className="space-y-4">
            {loadingCategories ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            ) : (
              categories.map(c => (
                <div key={c.id} className="bg-card rounded-xl border p-3 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">{c.icon || '📦'}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{c.name}</h3>
                      <p className="text-xs text-muted-foreground">/category/{c.slug}</p>
                      <div className="flex gap-1 mt-1">
                        {c.seo_title && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Title ✓</Badge>}
                        {c.seo_description && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Desc ✓</Badge>}
                        {c.seo_image && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Image ✓</Badge>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openCategoryEditor(c)}><Edit className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Pages SEO Tab */}
          <TabsContent value="pages" className="space-y-4">
            {loadingPages ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            ) : (
              pages.map(page => (
                <div key={page.id} className="bg-card rounded-2xl border p-4 hover:shadow-md transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{page.title}</h3>
                        <Badge className={page.is_published ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}>
                          {page.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{page.meta_description}</p>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Globe className="h-3 w-3" />/page/{page.slug}</span>
                      <div className="flex gap-1 mt-1">
                        {page.seo_title && <Badge variant="outline" className="text-[10px] px-1.5 py-0">SEO Title ✓</Badge>}
                        {page.seo_image && <Badge variant="outline" className="text-[10px] px-1.5 py-0">SEO Image ✓</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/page/${page.slug}`)}><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" onClick={() => openPageEditor(page)}><Edit className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Sitemap Tab */}
          <TabsContent value="sitemap" className="space-y-4">
            <div className="bg-card rounded-2xl border p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Globe className="h-5 w-5 text-primary" />Sitemap Management</h3>
              <p className="text-sm text-muted-foreground">Your sitemap is auto-generated and includes all active products, categories, and pages.</p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                  <Globe className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Sitemap URL</p>
                    <p className="text-xs text-muted-foreground truncate">https://p4no-marketplace.vercel.app/sitemap.xml</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => window.open('https://p4no-marketplace.vercel.app/sitemap.xml', '_blank')}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>

                <Button onClick={handleGenerateSitemap} disabled={generatingSitemap} className="w-full gap-2">
                  {generatingSitemap ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Generate Sitemap
                </Button>

                <Button onClick={handlePingSitemap} disabled={sitemapLoading} variant="outline" className="w-full gap-2">
                  {sitemapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Ping Google to Re-index Sitemap
                </Button>
              </div>

              <div className="border-t pt-4 space-y-2">
                <h4 className="font-medium text-sm">Google Search Console</h4>
                <p className="text-xs text-muted-foreground">Verification is already configured in index.html. Visit Google Search Console to manage your site's presence.</p>
                <Button variant="outline" size="sm" onClick={() => window.open('https://search.google.com/search-console', '_blank')} className="gap-2">
                  <ExternalLink className="h-4 w-4" />Open Search Console
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Page Editor Dialog */}
      <Dialog open={showPageEditor} onOpenChange={setShowPageEditor}>
        <DialogContent className="bg-card max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit: {editingPage?.slug}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Page Title</Label><Input value={pageForm.title} onChange={e => setPageForm({ ...pageForm, title: e.target.value })} /></div>
            <div>
              <Label>SEO Title (for search engines & social)</Label>
              <Input value={pageForm.seo_title} onChange={e => setPageForm({ ...pageForm, seo_title: e.target.value })} placeholder="Custom SEO title (leave empty to use page title)" />
              <p className="text-xs text-muted-foreground mt-1">{pageForm.seo_title.length}/60</p>
            </div>
            <div>
              <Label>Meta Description (SEO)</Label>
              <Textarea value={pageForm.meta_description} onChange={e => setPageForm({ ...pageForm, meta_description: e.target.value })} rows={2} placeholder="Under 160 chars..." />
              <p className="text-xs text-muted-foreground mt-1">{pageForm.meta_description.length}/160</p>
            </div>
            <div>
              <Label>SEO Image URL (for social preview)</Label>
              <Input value={pageForm.seo_image} onChange={e => setPageForm({ ...pageForm, seo_image: e.target.value })} placeholder="Image URL for Open Graph preview" />
              {pageForm.seo_image && <img src={pageForm.seo_image} alt="Preview" className="mt-2 h-20 rounded-lg object-cover" />}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Content</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-muted rounded-lg p-0.5">
                    <button onClick={() => { setIsHtmlMode(false); setShowPreview(false); }}
                      className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors", !isHtmlMode ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                      <Type className="h-3 w-3" /> Text
                    </button>
                    <button onClick={() => setIsHtmlMode(true)}
                      className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors", isHtmlMode ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
                      <Code className="h-3 w-3" /> HTML
                    </button>
                  </div>
                  {isHtmlMode && (
                    <button onClick={() => setShowPreview(!showPreview)}
                      className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors", showPreview ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground border-border')}>
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                  )}
                </div>
              </div>
              {showPreview ? (
                <div className="rounded-lg border p-4 min-h-[300px] bg-background overflow-auto">
                  <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: pageForm.content }} />
                </div>
              ) : (
                <Textarea value={pageForm.content} onChange={e => setPageForm({ ...pageForm, content: e.target.value })} rows={15} className={isHtmlMode ? 'font-mono text-xs' : ''} placeholder="Write page content..." />
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={pageForm.is_published} onCheckedChange={v => setPageForm({ ...pageForm, is_published: v })} />
                <Label>Published</Label>
              </div>
              <Button onClick={handleSavePage} disabled={savingPage} className="gap-2">
                <Save className="h-4 w-4" />{savingPage ? 'Saving...' : 'Save Page'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product SEO Editor Dialog */}
      <Dialog open={showProductEditor} onOpenChange={setShowProductEditor}>
        <DialogContent className="bg-card max-w-lg">
          <DialogHeader><DialogTitle>Product SEO: {editingProduct?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>SEO Title</Label>
              <Input value={productForm.seo_title} onChange={e => setProductForm({ ...productForm, seo_title: e.target.value })} placeholder="Product title for search engines" />
              <p className="text-xs text-muted-foreground mt-1">{productForm.seo_title.length}/60 chars recommended</p>
            </div>
            <div>
              <Label>SEO Description</Label>
              <Textarea value={productForm.seo_description} onChange={e => setProductForm({ ...productForm, seo_description: e.target.value })} rows={3} placeholder="Describe this product for Google..." />
              <p className="text-xs text-muted-foreground mt-1">{productForm.seo_description.length}/160 chars</p>
            </div>
            <div>
              <Label>SEO Image URL</Label>
              <Input value={productForm.seo_image} onChange={e => setProductForm({ ...productForm, seo_image: e.target.value })} placeholder="Image URL for social previews" />
              {productForm.seo_image && (
                <img src={productForm.seo_image} alt="Preview" className="mt-2 h-20 rounded-lg object-cover" />
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium mb-1">Preview URL:</p>
              <p className="text-xs text-primary break-all">/{editingProduct?.slug || 'generating...'}</p>
            </div>
            <Button onClick={handleSaveProduct} disabled={savingProduct} className="w-full gap-2">
              <Save className="h-4 w-4" />{savingProduct ? 'Saving...' : 'Save Product SEO'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category SEO Editor Dialog */}
      <Dialog open={showCategoryEditor} onOpenChange={setShowCategoryEditor}>
        <DialogContent className="bg-card max-w-lg">
          <DialogHeader><DialogTitle>Category SEO: {editingCategory?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>SEO Title</Label>
              <Input value={categoryForm.seo_title} onChange={e => setCategoryForm({ ...categoryForm, seo_title: e.target.value })} placeholder={`${editingCategory?.name} | p4no`} />
              <p className="text-xs text-muted-foreground mt-1">{categoryForm.seo_title.length}/60 chars</p>
            </div>
            <div>
              <Label>SEO Description</Label>
              <Textarea value={categoryForm.seo_description} onChange={e => setCategoryForm({ ...categoryForm, seo_description: e.target.value })} rows={4} placeholder="Describe this category for search engines..." />
              <p className="text-xs text-muted-foreground mt-1">{categoryForm.seo_description.length}/160 chars</p>
            </div>
            <div>
              <Label>SEO Image URL</Label>
              <Input value={categoryForm.seo_image} onChange={e => setCategoryForm({ ...categoryForm, seo_image: e.target.value })} placeholder="Image URL for social preview" />
              {categoryForm.seo_image && <img src={categoryForm.seo_image} alt="Preview" className="mt-2 h-20 rounded-lg object-cover" />}
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium mb-1">Category URL:</p>
              <p className="text-xs text-primary">/category/{editingCategory?.slug}</p>
            </div>
            <Button onClick={handleSaveCategory} disabled={savingCategory} className="w-full gap-2">
              <Save className="h-4 w-4" />{savingCategory ? 'Saving...' : 'Save Category SEO'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSeoPages;
