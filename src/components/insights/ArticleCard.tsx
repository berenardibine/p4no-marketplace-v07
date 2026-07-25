import { Link } from 'react-router-dom';
import type { InsightArticle } from '@/hooks/useInsights';
import { Clock } from 'lucide-react';

interface Props {
  article: InsightArticle;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const ArticleCard = ({ article, className = '', size = 'md' }: Props) => {
  const href = `/insights/article/${article.slug}`;
  return (
    <Link
      to={href}
      className={`group block rounded-2xl overflow-hidden bg-card border border-border/40 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all ${className}`}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {article.thumbnail_url ? (
          <img
            src={article.thumbnail_url}
            alt={article.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-orange-500/20" />
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className={`font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>
          {article.title}
        </h3>
        {article.excerpt && size !== 'sm' && (
          <p className="text-xs text-muted-foreground line-clamp-2">{article.excerpt}</p>
        )}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-0.5">
          <Clock className="h-3 w-3" />
          <span>{article.reading_time_min} min read</span>
          {article.published_at && (
            <>
              <span>·</span>
              <span>{new Date(article.published_at).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ArticleCard;