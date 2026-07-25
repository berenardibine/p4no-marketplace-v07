import { useNavigate } from "react-router-dom";
import { Grid2x2 } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { Skeleton } from "@/components/ui/skeleton";

// Redis-first (via useCategories → cache-products?type=categories) — no per-render Supabase read.
const HomeCategoriesGrid = () => {
  const navigate = useNavigate();
  const { categories, loading } = useCategories();

  return (
    <section className="animate-fade-up">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md shadow-primary/20">
          <Grid2x2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-base">Browse Categories</h2>
          <p className="text-[10px] text-muted-foreground">Everything you need in one place</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : categories.length === 0 ? null : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
          {categories.slice(0, 12).map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/category/${c.slug}`)}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-card border border-border/40 hover:border-primary/40 hover:shadow-md transition-all"
            >
              <span className="text-2xl">{c.icon || "📦"}</span>
              <span className="text-[10px] font-medium text-center line-clamp-2 leading-tight">
                {c.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default HomeCategoriesGrid;