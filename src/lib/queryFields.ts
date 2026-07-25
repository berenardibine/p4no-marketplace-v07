// Centralized column lists for listing queries.
// Keep narrow — these run on hot paths (homepage, category, search) and
// directly drive Supabase egress. Detail pages can still select *.

export const PRODUCT_CARD_FIELDS = `
  id, title, slug, price, images, category, location, status,
  created_at, views, likes, rental_unit, rental_fee, sponsored,
  product_type, country, currency_code, currency_symbol,
  is_negotiable, admin_posted, discount, discount_expiry,
  seller_id, shop_id
`;

export const PRODUCT_CARD_WITH_RELATIONS = `
  ${PRODUCT_CARD_FIELDS},
  seller:profiles!products_seller_id_fkey(id, full_name, profile_image, whatsapp_number, call_number),
  shop:shops(id, name, logo_url, trading_center)
`;

export const SERVICE_CARD_FIELDS = `
  id, title, slug, description, price, images, category, status,
  created_at, views, is_featured, seller_id, currency_symbol, country
`;

export const SERVICE_CARD_WITH_RELATIONS = `
  ${SERVICE_CARD_FIELDS},
  seller:profiles!services_seller_id_fkey(id, full_name, profile_image, identity_verified, rating, rating_count, whatsapp_number, call_number)
`;

export const ARTICLE_CARD_FIELDS = `
  id, title, slug, excerpt, thumbnail_url, category_id, author_id,
  published_at, views, reading_time_minutes
`;