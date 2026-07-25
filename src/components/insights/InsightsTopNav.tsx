import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Newspaper, Search, ArrowLeft } from 'lucide-react';
import { useInsightCategories } from '@/hooks/useInsights';
import { useState } from 'react';

interface Props { showBack?: boolean }

const InsightsTopNav = ({ showBack = false }: Props) => {
  const { data: categories = [] } = useInsightCategories();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="container px-4 h-14 flex items-center gap-3">
        {showBack && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/insights'))}
            className="h-9 w-9 -ml-1 inline-flex items-center justify-center rounded-full hover:bg-muted shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <Link to="/insights" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <Newspaper className="h-4 w-4 text-white" />
          </div>
          <span className="font-extrabold text-foreground">Insights</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
          <Link to="/" className="text-xs font-medium text-muted-foreground hover:text-primary px-3 py-1.5 rounded-full">Marketplace</Link>
          <Link to="/connect" className="text-xs font-medium text-muted-foreground hover:text-primary px-3 py-1.5 rounded-full">Connect</Link>
          <span className="w-px h-4 bg-border mx-1" />
          {categories.slice(0, 6).map((c) => (
            <NavLink
              key={c.id}
              to={`/insights/category/${c.slug}`}
              className={({ isActive }) =>
                `text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary'}`
              }
            >
              {c.name}
            </NavLink>
          ))}
        </nav>

        <form
          onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/insights/search/${encodeURIComponent(q.trim())}`); }}
          className="ml-auto relative"
        >
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search insights…"
            className="h-9 w-36 sm:w-56 pl-8 pr-3 rounded-full bg-muted text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </form>
      </div>
      {/* mobile category chips */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto scrollbar-hide px-4 pb-2">
        {categories.map((c) => (
          <NavLink
            key={c.id}
            to={`/insights/category/${c.slug}`}
            className={({ isActive }) =>
              `text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`
            }
          >
            {c.name}
          </NavLink>
        ))}
      </div>
    </header>
  );
};

export default InsightsTopNav;