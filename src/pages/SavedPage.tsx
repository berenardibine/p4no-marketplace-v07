import { ArrowLeft, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useSavedItemsList } from '@/hooks/useSavedItems';
import { useAuth } from '@/hooks/useAuth';
import TrackableProductCard from '@/components/home/TrackableProductCard';
import ServiceCard from '@/components/connect/ServiceCard';

const SavedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { products, services, loading } = useSavedItemsList();

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
        <div>
          <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h2 className="font-bold text-lg">Sign in to see saved items</h2>
          <button onClick={() => navigate('/auth')} className="mt-4 px-5 h-11 rounded-xl bg-primary text-primary-foreground font-semibold">Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="font-bold text-lg">Saved</h1>
      </header>
      <div className="px-4 py-4">
        <Tabs defaultValue="products">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
            <TabsTrigger value="services">Services ({services.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="products">
            {loading ? (
              <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
            ) : products.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">No saved products yet</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.map((p: any) => (
                  <TrackableProductCard
                    key={p.id}
                    id={p.id}
                    slug={p.slug}
                    title={p.title}
                    price={p.price}
                    images={p.images || []}
                    rentalUnit={p.rental_unit}
                    isSponsored={p.sponsored}
                    isAdminPosted={p.admin_posted}
                    isNegotiable={p.is_negotiable}
                    videoUrl={p.video_url}
                    videoThumbnail={p.video_thumbnail}
                    refSource="saved"
                  />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="services">
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
            ) : services.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">No saved services yet</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {services.map((s: any) => <ServiceCard key={s.id} service={s} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SavedPage;
