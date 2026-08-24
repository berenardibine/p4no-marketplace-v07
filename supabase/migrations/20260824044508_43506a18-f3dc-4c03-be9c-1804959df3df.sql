-- ============================================================
-- Static generation triggers (lost in remix) + queue hygiene
-- ============================================================

-- PRODUCTS: enqueue on insert/delete always; on update only when a
-- content column changes (never on views/likes/impressions bumps).
DROP TRIGGER IF EXISTS trg_products_static_insdel ON public.products;
CREATE TRIGGER trg_products_static_insdel
AFTER INSERT OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_business_change('product');

DROP TRIGGER IF EXISTS trg_products_static_upd ON public.products;
CREATE TRIGGER trg_products_static_upd
AFTER UPDATE ON public.products
FOR EACH ROW
WHEN (
  NEW.title IS DISTINCT FROM OLD.title OR
  NEW.slug IS DISTINCT FROM OLD.slug OR
  NEW.description IS DISTINCT FROM OLD.description OR
  NEW.description_structured IS DISTINCT FROM OLD.description_structured OR
  NEW.price IS DISTINCT FROM OLD.price OR
  NEW.quantity IS DISTINCT FROM OLD.quantity OR
  NEW.images IS DISTINCT FROM OLD.images OR
  NEW.category IS DISTINCT FROM OLD.category OR
  NEW.location IS DISTINCT FROM OLD.location OR
  NEW.status IS DISTINCT FROM OLD.status OR
  NEW.video_url IS DISTINCT FROM OLD.video_url OR
  NEW.video_thumbnail IS DISTINCT FROM OLD.video_thumbnail OR
  NEW.is_negotiable IS DISTINCT FROM OLD.is_negotiable OR
  NEW.rental_rate_type IS DISTINCT FROM OLD.rental_rate_type OR
  NEW.contact_whatsapp IS DISTINCT FROM OLD.contact_whatsapp OR
  NEW.contact_call IS DISTINCT FROM OLD.contact_call OR
  NEW.discount IS DISTINCT FROM OLD.discount OR
  NEW.discount_expiry IS DISTINCT FROM OLD.discount_expiry OR
  NEW.shop_id IS DISTINCT FROM OLD.shop_id OR
  NEW.location_id IS DISTINCT FROM OLD.location_id OR
  NEW.product_type IS DISTINCT FROM OLD.product_type OR
  NEW.admin_posted IS DISTINCT FROM OLD.admin_posted OR
  NEW.admin_phone IS DISTINCT FROM OLD.admin_phone OR
  NEW.admin_location IS DISTINCT FROM OLD.admin_location OR
  NEW.show_connect_button IS DISTINCT FROM OLD.show_connect_button OR
  NEW.sponsored IS DISTINCT FROM OLD.sponsored OR
  NEW.rental_fee IS DISTINCT FROM OLD.rental_fee OR
  NEW.rental_unit IS DISTINCT FROM OLD.rental_unit OR
  NEW.rental_status IS DISTINCT FROM OLD.rental_status OR
  NEW.country IS DISTINCT FROM OLD.country OR
  NEW.currency_code IS DISTINCT FROM OLD.currency_code OR
  NEW.currency_symbol IS DISTINCT FROM OLD.currency_symbol OR
  NEW.lat IS DISTINCT FROM OLD.lat OR
  NEW.lng IS DISTINCT FROM OLD.lng OR
  NEW.seo_title IS DISTINCT FROM OLD.seo_title OR
  NEW.seo_description IS DISTINCT FROM OLD.seo_description OR
  NEW.seo_image IS DISTINCT FROM OLD.seo_image OR
  NEW.minimum_quantity IS DISTINCT FROM OLD.minimum_quantity OR
  NEW.unlimited_quantity IS DISTINCT FROM OLD.unlimited_quantity OR
  NEW.tags IS DISTINCT FROM OLD.tags OR
  NEW.admin_shop_name IS DISTINCT FROM OLD.admin_shop_name OR
  NEW.seller_id IS DISTINCT FROM OLD.seller_id
)
EXECUTE FUNCTION public.trg_enqueue_business_change('product');

-- SERVICES
DROP TRIGGER IF EXISTS trg_services_static_insdel ON public.services;
CREATE TRIGGER trg_services_static_insdel
AFTER INSERT OR DELETE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_business_change('service');

DROP TRIGGER IF EXISTS trg_services_static_upd ON public.services;
CREATE TRIGGER trg_services_static_upd
AFTER UPDATE ON public.services
FOR EACH ROW
WHEN (
  NEW.title IS DISTINCT FROM OLD.title OR
  NEW.slug IS DISTINCT FROM OLD.slug OR
  NEW.category IS DISTINCT FROM OLD.category OR
  NEW.short_description IS DISTINCT FROM OLD.short_description OR
  NEW.description IS DISTINCT FROM OLD.description OR
  NEW.pricing_type IS DISTINCT FROM OLD.pricing_type OR
  NEW.price IS DISTINCT FROM OLD.price OR
  NEW.currency_symbol IS DISTINCT FROM OLD.currency_symbol OR
  NEW.currency_code IS DISTINCT FROM OLD.currency_code OR
  NEW.location IS DISTINCT FROM OLD.location OR
  NEW.country IS DISTINCT FROM OLD.country OR
  NEW.lat IS DISTINCT FROM OLD.lat OR
  NEW.lng IS DISTINCT FROM OLD.lng OR
  NEW.whatsapp_number IS DISTINCT FROM OLD.whatsapp_number OR
  NEW.phone_number IS DISTINCT FROM OLD.phone_number OR
  NEW.images IS DISTINCT FROM OLD.images OR
  NEW.video_url IS DISTINCT FROM OLD.video_url OR
  NEW.video_thumbnail IS DISTINCT FROM OLD.video_thumbnail OR
  NEW.years_experience IS DISTINCT FROM OLD.years_experience OR
  NEW.availability IS DISTINCT FROM OLD.availability OR
  NEW.portfolio_links IS DISTINCT FROM OLD.portfolio_links OR
  NEW.status IS DISTINCT FROM OLD.status OR
  NEW.is_featured IS DISTINCT FROM OLD.is_featured OR
  NEW.seller_id IS DISTINCT FROM OLD.seller_id
)
EXECUTE FUNCTION public.trg_enqueue_business_change('service');

-- INSIGHT ARTICLES
DROP TRIGGER IF EXISTS trg_articles_static_insdel ON public.insight_articles;
CREATE TRIGGER trg_articles_static_insdel
AFTER INSERT OR DELETE ON public.insight_articles
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_business_change('article');

DROP TRIGGER IF EXISTS trg_articles_static_upd ON public.insight_articles;
CREATE TRIGGER trg_articles_static_upd
AFTER UPDATE ON public.insight_articles
FOR EACH ROW
WHEN (
  NEW.title IS DISTINCT FROM OLD.title OR
  NEW.slug IS DISTINCT FROM OLD.slug OR
  NEW.excerpt IS DISTINCT FROM OLD.excerpt OR
  NEW.body IS DISTINCT FROM OLD.body OR
  NEW.body_html IS DISTINCT FROM OLD.body_html OR
  NEW.thumbnail_url IS DISTINCT FROM OLD.thumbnail_url OR
  NEW.thumbnail_blur IS DISTINCT FROM OLD.thumbnail_blur OR
  NEW.category_id IS DISTINCT FROM OLD.category_id OR
  NEW.author_id IS DISTINCT FROM OLD.author_id OR
  NEW.tags IS DISTINCT FROM OLD.tags OR
  NEW.meta_title IS DISTINCT FROM OLD.meta_title OR
  NEW.meta_description IS DISTINCT FROM OLD.meta_description OR
  NEW.seo_keywords IS DISTINCT FROM OLD.seo_keywords OR
  NEW.og_image_url IS DISTINCT FROM OLD.og_image_url OR
  NEW.status IS DISTINCT FROM OLD.status OR
  NEW.published_at IS DISTINCT FROM OLD.published_at OR
  NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for OR
  NEW.reading_time_min IS DISTINCT FROM OLD.reading_time_min
)
EXECUTE FUNCTION public.trg_enqueue_business_change('article');

-- CATEGORIES & SHOPS (low-frequency tables: any real change enqueues)
DROP TRIGGER IF EXISTS trg_categories_static ON public.categories;
CREATE TRIGGER trg_categories_static
AFTER INSERT OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_business_change('category');

DROP TRIGGER IF EXISTS trg_categories_static_upd ON public.categories;
CREATE TRIGGER trg_categories_static_upd
AFTER UPDATE ON public.categories
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.trg_enqueue_business_change('category');

DROP TRIGGER IF EXISTS trg_shops_static ON public.shops;
CREATE TRIGGER trg_shops_static
AFTER INSERT OR DELETE ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_business_change('shop');

DROP TRIGGER IF EXISTS trg_shops_static_upd ON public.shops;
CREATE TRIGGER trg_shops_static_upd
AFTER UPDATE ON public.shops
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.trg_enqueue_business_change('shop');

-- Queue hygiene: reset rows orphaned in 'running' by crashed worker runs.
UPDATE public.generation_queue
SET status = 'done',
    error = 'stale_reset',
    completed_at = now()
WHERE status = 'running'
  AND started_at < now() - interval '30 minutes';