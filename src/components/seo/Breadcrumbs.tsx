import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useEffect } from 'react';

export interface Crumb {
  name: string;
  url: string;
}

interface Props {
  items: Crumb[];
  className?: string;
  id?: string;
  baseUrl?: string;
}

/**
 * Visible breadcrumb UI + BreadcrumbList JSON-LD in one component.
 * Pass relative URLs; absolute resolution for JSON-LD uses window.location.origin
 * (or `baseUrl` if provided).
 */
const Breadcrumbs = ({ items, className = '', id = 'breadcrumb-jsonld', baseUrl }: Props) => {
  useEffect(() => {
    if (!items?.length) return;
    const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const data = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: c.url.startsWith('http') ? c.url : `${origin}${c.url}`,
      })),
    };
    let s = document.getElementById(id) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.id = id;
      s.type = 'application/ld+json';
      document.head.appendChild(s);
    }
    s.textContent = JSON.stringify(data);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [items, id, baseUrl]);

  if (!items?.length) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-xs sm:text-sm text-muted-foreground overflow-x-auto ${className}`}
    >
      <ol className="flex items-center gap-1 whitespace-nowrap">
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${c.url}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60 shrink-0" />}
              {isLast ? (
                <span aria-current="page" className="font-medium text-foreground truncate max-w-[160px]">
                  {c.name}
                </span>
              ) : (
                <Link
                  to={c.url}
                  className="hover:text-primary transition-colors inline-flex items-center gap-1 truncate max-w-[140px]"
                >
                  {i === 0 && c.url === '/' && <Home className="h-3.5 w-3.5" />}
                  {c.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;