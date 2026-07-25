import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageMetaTags from "@/components/seo/PageMetaTags";

const SitePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) fetchPage();
  }, [slug]);

  const fetchPage = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('site_pages')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    
    setPage(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <button onClick={() => navigate('/')} className="text-primary hover:underline">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const metaTitle = page.seo_title || `${page.title} | p4no`;
  const metaDescription = page.meta_description || `Learn more about ${page.title} at p4no.`;

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageMetaTags
        title={metaTitle}
        description={metaDescription}
        image={page.seo_image || undefined}
        url={`/${page.slug}`}
      />
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg truncate">{page.title}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
        <p className="text-xs text-muted-foreground mt-8 pt-4 border-t">
          Last updated: {page.updated_at && new Date(page.updated_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default SitePage;
