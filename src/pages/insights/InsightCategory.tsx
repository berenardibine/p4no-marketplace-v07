import { useParams, Link } from 'react-router-dom';
import InsightsTopNav from '@/components/insights/InsightsTopNav';
import ArticleCard from '@/components/insights/ArticleCard';
import PageMetaTags from '@/components/seo/PageMetaTags';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { useInsightArticles, useInsightCategories } from '@/hooks/useInsights';

const PER_PAGE = 12;

const InsightCategory = () => {
  const { slug, page } = useParams();
  const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
  const { data: cats = [] } = useInsightCategories();
  const cat = cats.find((c) => c.slug === slug);
  const { data } = useInsightArticles({ categorySlug: slug, limit: PER_PAGE, offset: (pageNum - 1) * PER_PAGE });
  const articles = data?.rows || [];
  const totalPages = Math.max(1, Math.ceil((data?.count || 0) / PER_PAGE));

  const title = cat ? `${cat.name} — P4NO Insights` : 'Insights — P4NO';
  const description = cat?.description || `Read articles in ${cat?.name || 'this category'} on P4NO Insights.`;
  const canonical = pageNum === 1 ? `/insights/category/${slug}` : `/insights/category/${slug}/page/${pageNum}`;

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageMetaTags title={title} description={description} url={canonical} />
      <InsightsTopNav showBack />
      <main className="container px-4 py-6 space-y-6">
        <Breadcrumbs items={[
          { name: 'Home', url: '/' },
          { name: 'Insights', url: '/insights' },
          { name: cat?.name || (slug || ''), url: `/insights/category/${slug}` },
        ]} />

        <header className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">{cat?.name || slug}</h1>
          {description && <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>}
        </header>

        {articles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No articles in this category yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 pt-4">
            {pageNum > 1 && (
              <Link to={pageNum === 2 ? `/insights/category/${slug}` : `/insights/category/${slug}/page/${pageNum - 1}`}
                rel="prev"
                className="px-3 py-1.5 rounded-lg bg-muted text-xs font-semibold">Previous</Link>
            )}
            <span className="text-xs text-muted-foreground">Page {pageNum} of {totalPages}</span>
            {pageNum < totalPages && (
              <Link to={`/insights/category/${slug}/page/${pageNum + 1}`}
                rel="next"
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">Next</Link>
            )}
          </nav>
        )}
      </main>
    </div>
  );
};

export default InsightCategory;