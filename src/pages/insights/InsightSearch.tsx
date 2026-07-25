import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import InsightsTopNav from '@/components/insights/InsightsTopNav';
import ArticleCard from '@/components/insights/ArticleCard';
import PageMetaTags from '@/components/seo/PageMetaTags';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import { useInsightArticles } from '@/hooks/useInsights';

const InsightSearch = () => {
  const { q } = useParams();
  const navigate = useNavigate();
  const query = decodeURIComponent(q || '');
  const [input, setInput] = useState(query);
  const { data } = useInsightArticles({ q: query, limit: 24 });
  const articles = data?.rows || [];

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageMetaTags
        title={`Search: ${query} — P4NO Insights`}
        description={`Articles matching "${query}" on P4NO Insights.`}
        url={`/insights/search/${encodeURIComponent(query)}`}
      />
      <InsightsTopNav showBack />
      <main className="container px-4 py-6 space-y-6">
        <Breadcrumbs items={[
          { name: 'Home', url: '/' },
          { name: 'Insights', url: '/insights' },
          { name: `Search: ${query}`, url: `/insights/search/${encodeURIComponent(query)}` },
        ]} />

        <form
          onSubmit={(e) => { e.preventDefault(); if (input.trim()) navigate(`/insights/search/${encodeURIComponent(input.trim())}`); }}
          className="flex gap-2"
        >
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Search articles…"
            className="flex-1 h-10 px-4 rounded-full bg-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button className="px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold">Search</button>
        </form>

        <h1 className="text-xl font-bold text-foreground">Results for "{query}"</h1>

        {articles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No articles matched your search.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        )}
      </main>
    </div>
  );
};

export default InsightSearch;