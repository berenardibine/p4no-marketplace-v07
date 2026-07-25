import InsightsTopNav from '@/components/insights/InsightsTopNav';
import ArticleCard from '@/components/insights/ArticleCard';
import PageMetaTags from '@/components/seo/PageMetaTags';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { useInsightArticles, useInsightCategories } from '@/hooks/useInsights';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import PopularArticlesThisWeek from '@/components/insights/PopularArticlesThisWeek';

const InsightsHome = () => {
  const { data: cats = [] } = useInsightCategories();
  const { data: latest } = useInsightArticles({ limit: 24 });
  const featured = (latest?.rows || [])[0];
  const rest = (latest?.rows || []).slice(1);

  useEffect(() => {
    const s = document.createElement('script');
    s.id = 'insights-blog-jsonld';
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'P4NO Insights',
      url: typeof window !== 'undefined' ? window.location.origin + '/insights' : '/insights',
    });
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageMetaTags
        title="P4NO Insights — Stories, tips & ideas for sellers and buyers"
        description="Read the latest articles, business tips, and platform news from P4NO Insights — your editorial hub for the marketplace and service ecosystem."
        url="/insights"
      />
      <InsightsTopNav />

      <main className="container px-4 py-6 space-y-8">
        <Breadcrumbs items={[{ name: 'Home', url: '/' }, { name: 'Insights', url: '/insights' }]} />

        <section className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">P4NO Insights</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Editorial stories, how-to guides, and platform news to help you sell smarter, find trusted services, and grow your business with P4NO.
          </p>
        </section>

        {featured && (
          <section>
            <h2 className="sr-only">Featured</h2>
            <ArticleCard article={featured} size="lg" className="md:flex md:items-stretch" />
          </section>
        )}

        <PopularArticlesThisWeek />

        {cats.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Browse categories</h2>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <Link key={c.id} to={`/insights/category/${c.slug}`}
                  className="px-3 py-1.5 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground text-xs font-semibold transition-colors">
                  {c.icon ? `${c.icon} ` : ''}{c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Latest articles</h2>
          {rest.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No articles yet. Check back soon!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default InsightsHome;