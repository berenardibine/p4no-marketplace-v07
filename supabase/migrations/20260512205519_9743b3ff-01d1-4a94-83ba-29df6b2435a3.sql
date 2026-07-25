-- FOLLOWS
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('shop','provider')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_target ON public.follows(target_type, target_id);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users insert own follows" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users delete own follows" ON public.follows FOR DELETE USING (auth.uid() = follower_id);
CREATE POLICY "Admin full access follows" ON public.follows FOR ALL USING (public.has_role(auth.uid(),'admin'::app_role));

-- SAVED ITEMS
CREATE TABLE IF NOT EXISTS public.saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('product','service')),
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_items_user ON public.saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_item ON public.saved_items(item_type, item_id);
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own saved" ON public.saved_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own saved" ON public.saved_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own saved" ON public.saved_items FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admin full access saved" ON public.saved_items FOR ALL USING (public.has_role(auth.uid(),'admin'::app_role));

-- ACTIVITY EVENTS
CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON public.activity_events(entity_type, entity_id);
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone insert activity" ON public.activity_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Users read own activity" ON public.activity_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin full access activity" ON public.activity_events FOR ALL USING (public.has_role(auth.uid(),'admin'::app_role));

-- Notifications new columns
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id uuid;

-- Backfill user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'seller'::app_role FROM public.profiles WHERE user_type = 'seller'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'buyer'::app_role FROM public.profiles
WHERE user_type IS DISTINCT FROM 'seller'
ON CONFLICT (user_id, role) DO NOTHING;

-- Notify on new follow
CREATE OR REPLACE FUNCTION public.notify_on_new_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid; follower_name text;
BEGIN
  IF NEW.target_type = 'shop' THEN
    SELECT seller_id INTO owner_id FROM public.shops WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'provider' THEN
    owner_id := NEW.target_id;
  END IF;
  IF owner_id IS NOT NULL AND owner_id <> NEW.follower_id THEN
    SELECT full_name INTO follower_name FROM public.profiles WHERE id = NEW.follower_id;
    INSERT INTO public.notifications (user_id, title, message, type, module, entity_type, entity_id, actor_id)
    VALUES (owner_id, 'New follower', COALESCE(follower_name,'Someone') || ' started following you',
            'follow', 'follows', NEW.target_type, NEW.target_id, NEW.follower_id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_on_new_follow ON public.follows;
CREATE TRIGGER trg_notify_on_new_follow AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_follow();

-- Notify followers on new product
CREATE OR REPLACE FUNCTION public.notify_followers_on_new_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.shop_id IS NULL OR NEW.status <> 'active' THEN RETURN NEW; END IF;
  FOR r IN SELECT follower_id FROM public.follows WHERE target_type='shop' AND target_id = NEW.shop_id LOOP
    INSERT INTO public.notifications (user_id, title, message, type, module, entity_type, entity_id)
    VALUES (r.follower_id, 'New product from a shop you follow', NEW.title, 'new_product', 'products', 'product', NEW.id);
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_followers_new_product ON public.products;
CREATE TRIGGER trg_notify_followers_new_product AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_new_product();

-- Notify on price drop
CREATE OR REPLACE FUNCTION public.notify_on_price_drop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.price >= OLD.price THEN RETURN NEW; END IF;
  FOR r IN SELECT user_id FROM public.saved_items WHERE item_type='product' AND item_id = NEW.id LOOP
    INSERT INTO public.notifications (user_id, title, message, type, module, entity_type, entity_id)
    VALUES (r.user_id, 'Price drop on a saved product', NEW.title || ' is now cheaper', 'price_drop', 'products', 'product', NEW.id);
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_on_price_drop ON public.products;
CREATE TRIGGER trg_notify_on_price_drop AFTER UPDATE OF price ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_on_price_drop();