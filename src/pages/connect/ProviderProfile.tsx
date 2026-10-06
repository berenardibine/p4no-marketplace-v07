import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, Star, MapPin, Phone, MessageCircle, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getContent } from '@/lib/cdnGuard';
import { isStrictStaticMode } from '@/lib/staticFlags';
import { useServices } from '@/hooks/useServices';
import ServiceCard from '@/components/connect/ServiceCard';
import { Button } from '@/components/ui/button';
import { optimizeCloudinaryUrl } from '@/lib/cloudinary';
import { sanitizePhone } from '@/lib/whatsappService';
import FollowButton from '@/components/social/FollowButton';
import { useFollow } from '@/hooks/useFollow';
import { logActivity } from '@/lib/activityEvents';
import PageMetaTags from '@/components/seo/PageMetaTags';
import Breadcrumbs from '@/components/seo/Breadcrumbs';

const ProviderProfile = () => {
  const { userId, slug } = useParams<{ userId?: string; slug?: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const lookup = userId || slug || '';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookup);
  const { services, loading } = useServices({ sellerId: profile?.id, limit: 24 });

  const { count: followerCount, countLoaded, loadCount } = useFollow('provider', profile?.id || null);

  useEffect(() => {
    if (!lookup) return;
    let cancelled = false;
    (async () => {
      // Static-first: seller profile is a pre-built CDN JSON.
      const cached = await getContent<any>(`sellers/${lookup}`);
      if (cached && !cancelled) {
        setProfile(cached);
        if (cached?.id) logActivity({ event_type: 'provider_view', entity_type: 'provider', entity_id: cached.id });
        return;
      }
      if (isStrictStaticMode()) return; // strict mode: never fall back to DB
      const q = supabase.from('profiles').select('id, full_name, business_name, bio, profile_image, rating, rating_count, identity_verified, is_verified, city, region, country, slug, created_at');
      const { data } = await (isUuid ? q.eq('id', lookup) : q.eq('slug', lookup)).maybeSingle();
      if (cancelled) return;
      if (data?.id) {
        const { data: c } = await supabase.rpc('get_seller_contact' as any, { _seller_id: data.id });
        const row: any = Array.isArray(c) ? c[0] : c;
        if (row) Object.assign(data as any, row);
      }
      setProfile(data);
      if (data?.id) logActivity({ event_type: 'provider_view', entity_type: 'provider', entity_id: data.id });
    })();
    return () => { cancelled = true; };
  }, [lookup, isUuid]);

  if (!profile) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  const wa = sanitizePhone(profile.whatsapp_number);
  const canonicalPath = profile.slug ? `/connect/provider/slug/${profile.slug}` : `/connect/provider/${profile.id}`;
  const metaTitle = `${profile.full_name || 'Service Provider'} – Services on P4NO`;
  const metaDesc = (profile.bio || `Discover services offered by ${profile.full_name || 'this provider'} on P4NO. Trusted, verified providers worldwide.`).slice(0, 160);

  return (
    <div className="min-h-screen bg-background pb-12">
      <PageMetaTags
        title={metaTitle}
        description={metaDesc}
        image={profile.profile_image || undefined}
        url={canonicalPath}
        type="profile"
      />
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 h-14 px-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="font-semibold text-sm truncate flex-1">{profile.full_name}</h1>
        </div>
      </header>

      <div className="px-4 pt-3">
        <Breadcrumbs
          items={[
            { name: 'Home', url: '/' },
            { name: 'Connect', url: '/connect' },
            { name: profile.full_name || 'Provider', url: canonicalPath },
          ]}
          id="breadcrumb-provider-jsonld"
        />
      </div>

      <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 text-center border-b">
        <div className="w-24 h-24 rounded-full mx-auto bg-card border-4 border-card overflow-hidden shadow-lg">
          {profile.profile_image ? <img src={optimizeCloudinaryUrl(profile.profile_image)} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">{(profile.full_name || 'P')[0]}</div>}
        </div>
        <h2 className="text-xl font-bold mt-3 flex items-center justify-center gap-1">
          {profile.full_name}
          {profile.identity_verified && <ShieldCheck className="h-5 w-5 text-emerald-500" />}
        </h2>
        {profile.bio && <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{profile.bio}</p>}
        <div className="flex items-center justify-center gap-3 mt-2 text-xs text-muted-foreground">
          {Number(profile.rating) > 0 && <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(profile.rating).toFixed(1)}</span>}
          {profile.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{profile.location}</span>}
          {countLoaded
            ? <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{followerCount} {followerCount === 1 ? 'follower' : 'followers'}</span>
            : <button type="button" onClick={loadCount} className="inline-flex items-center gap-1 underline"><Users className="h-3 w-3" />Show followers</button>}
        </div>
        <div className="flex gap-2 justify-center mt-4 flex-wrap">
          <FollowButton targetType="provider" targetId={profile.id} size="sm" />
          {profile.call_number && <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(`tel:${profile.call_number}`, '_self')}><Phone className="h-3 w-3" />Call</Button>}
          {wa && <Button size="sm" className="gap-1 bg-emerald-500 hover:bg-emerald-600" onClick={() => window.open(`https://wa.me/${wa}`, '_blank')}><MessageCircle className="h-3 w-3" />WhatsApp</Button>}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <h3 className="font-bold text-base">Services ({services.length})</h3>
        {loading ? <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
          : services.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">No services yet</div>
          : <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{services.map(s => <ServiceCard key={s.id} service={s} compact />)}</div>}
      </div>
    </div>
  );
};

export default ProviderProfile;
