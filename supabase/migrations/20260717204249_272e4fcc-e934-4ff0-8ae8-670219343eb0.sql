
-- ============================================================
-- P4NO GROWTH ENGINE — FOUNDATION MIGRATION
-- ============================================================

-- 1. GROWTH CONFIG (admin-editable single source of truth)
CREATE TABLE IF NOT EXISTS public.growth_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.growth_config TO anon, authenticated;
GRANT ALL ON public.growth_config TO service_role;
ALTER TABLE public.growth_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "growth_config public read" ON public.growth_config FOR SELECT USING (true);
CREATE POLICY "growth_config admin write" ON public.growth_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.growth_config(key, value, description) VALUES
  ('reward.seller_referral', '500'::jsonb, 'Points awarded when a seller referral qualifies'),
  ('reward.buyer_referral', '250'::jsonb, 'Points awarded when a buyer referral qualifies'),
  ('reward.commission_pct', '10'::jsonb, 'Level-1 referrer commission percentage'),
  ('reward.min_withdrawal', '500'::jsonb, 'Minimum points required to withdraw'),
  ('reward.conversion_rate_usd_per_100', '0.5'::jsonb, 'USD paid per 100 points'),
  ('growth.buyer_threshold', '30'::jsonb, 'Growth score needed to qualify a buyer referral'),
  ('growth.event_weights', '{
    "register":2,"email_verified":2,"phone_verified":2,"profile_completed":2,
    "follow_seller":2,"like_product":1,"like_reel":1,"like_service":1,
    "comment":2,"reply":1,"rating":3,"wishlist":2,"share_product":3,
    "order_created":10,"order_completed":20
  }'::jsonb, 'Buyer growth score weights per action'),
  ('fraud.threshold_medium', '30'::jsonb, 'Score threshold for medium risk'),
  ('fraud.threshold_high', '70'::jsonb, 'Score threshold for high risk (auto-reject)'),
  ('level.thresholds', '{
    "bronze":0,"silver":5,"gold":20,"platinum":50,"diamond":150
  }'::jsonb, 'Verified-referral thresholds per level'),
  ('achievements.rules', '[
    {"key":"verified_ambassador","label":"Verified Ambassador","min_verified":10},
    {"key":"100_referrals","label":"100 Referrals","min_verified":100},
    {"key":"10_sellers","label":"10 Sellers","min_verified_sellers":10},
    {"key":"100_orders","label":"100 Orders","min_orders":100},
    {"key":"community_builder","label":"Community Builder","min_growth_events":500},
    {"key":"top_creator","label":"Top Creator","min_reels":10}
  ]'::jsonb, 'Achievement rules'),
  ('payout.rwanda_methods', '["mtn","airtel","binance"]'::jsonb, 'Payout methods for Rwanda'),
  ('payout.global_methods', '["binance"]'::jsonb, 'Payout methods for other countries')
ON CONFLICT (key) DO NOTHING;

-- helper: read config values fast
CREATE OR REPLACE FUNCTION public.gcfg(_key TEXT) RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT value FROM public.growth_config WHERE key=_key
$$;

-- 2. EXTEND REFERRALS
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS growth_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS fraud_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_level TEXT,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;
UPDATE public.referrals SET type = CASE WHEN is_seller_referral THEN 'seller' ELSE 'buyer' END WHERE type IS NULL;

-- 3. EXTEND WALLETS
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS pending_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_earnings INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS action_earnings INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_earnings INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_earnings INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_earnings INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn INTEGER NOT NULL DEFAULT 0;

-- 4. GROWTH EVENTS
CREATE TABLE IF NOT EXISTS public.growth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 0,
  entity_id UUID,
  entity_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS growth_events_user_idx ON public.growth_events(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS growth_events_dedup_idx ON public.growth_events(user_id, event_type, entity_id) WHERE entity_id IS NOT NULL;
GRANT SELECT ON public.growth_events TO authenticated;
GRANT ALL ON public.growth_events TO service_role;
ALTER TABLE public.growth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "growth_events own read" ON public.growth_events FOR SELECT TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));

-- 5. REWARD CLAIMS
CREATE TABLE IF NOT EXISTS public.reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  points INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  fraud_score INTEGER NOT NULL DEFAULT 0,
  fraud_level TEXT NOT NULL DEFAULT 'low',
  rejection_reason TEXT,
  reference JSONB,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reward_claims_user_idx ON public.reward_claims(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reward_claims_status_idx ON public.reward_claims(status, created_at DESC);
GRANT SELECT ON public.reward_claims TO authenticated;
GRANT ALL ON public.reward_claims TO service_role;
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reward_claims own read" ON public.reward_claims FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "reward_claims admin write" ON public.reward_claims FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 6. WALLET LEDGER (append-only)
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  bucket TEXT NOT NULL,
  points INTEGER NOT NULL,
  usd_equiv NUMERIC(12,4) NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  reference_id UUID,
  reference_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_ledger_user_idx ON public.wallet_ledger(user_id, created_at DESC);
GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_ledger own read" ON public.wallet_ledger FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
-- block direct writes; only SECURITY DEFINER functions bypass RLS
CREATE POLICY "wallet_ledger no user write" ON public.wallet_ledger FOR INSERT TO authenticated WITH CHECK (false);

-- 7. WITHDRAWALS
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  usd_amount NUMERIC(12,2) NOT NULL,
  conversion_rate_snapshot NUMERIC(12,6) NOT NULL,
  method TEXT NOT NULL,
  payload JSONB NOT NULL,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_reference TEXT,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS withdrawals_user_idx ON public.withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON public.withdrawals(status, created_at DESC);
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals own read" ON public.withdrawals FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "withdrawals admin write" ON public.withdrawals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 8. FRAUD SIGNALS
CREATE TABLE IF NOT EXISTS public.fraud_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES public.reward_claims(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE CASCADE,
  user_id UUID,
  device_fingerprint TEXT,
  ip TEXT,
  is_vpn BOOLEAN DEFAULT false,
  is_proxy BOOLEAN DEFAULT false,
  is_self_referral BOOLEAN DEFAULT false,
  duplicate_matches JSONB,
  score INTEGER NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'low',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fraud_signals TO authenticated;
GRANT ALL ON public.fraud_signals TO service_role;
ALTER TABLE public.fraud_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fraud_signals admin read" ON public.fraud_signals FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 9. USER LEVELS
CREATE TABLE IF NOT EXISTS public.user_levels (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'bronze',
  verified_referrals INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_levels TO anon, authenticated;
GRANT ALL ON public.user_levels TO service_role;
ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_levels public read" ON public.user_levels FOR SELECT USING (true);

-- 10. USER ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);
GRANT SELECT ON public.user_achievements TO anon, authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_achievements public read" ON public.user_achievements FOR SELECT USING (true);

-- 11. LEADERBOARD SNAPSHOTS
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL, -- weekly | monthly | all_time
  category TEXT NOT NULL, -- referrers | sellers | buyers | earners | ambassadors
  user_id UUID NOT NULL,
  rank INTEGER NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leaderboard_idx ON public.leaderboard_snapshots(period, category, rank);
GRANT SELECT ON public.leaderboard_snapshots TO anon, authenticated;
GRANT ALL ON public.leaderboard_snapshots TO service_role;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaderboard public read" ON public.leaderboard_snapshots FOR SELECT USING (true);

-- ============================================================
-- CORE FUNCTIONS
-- ============================================================

-- Ensure every profile has a wallet + referral code
CREATE OR REPLACE FUNCTION public.ensure_growth_bootstrap(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _code TEXT;
BEGIN
  INSERT INTO public.wallets(user_id) VALUES(_user) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_levels(user_id) VALUES(_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT referral_code INTO _code FROM public.profiles WHERE id=_user;
  IF _code IS NULL OR _code='' THEN
    _code := upper(substring(replace(gen_random_uuid()::text,'-',''),1,8));
    UPDATE public.profiles SET referral_code=_code WHERE id=_user;
  END IF;
END $$;

-- Conversion helper
CREATE OR REPLACE FUNCTION public.points_to_usd(_points INTEGER) RETURNS NUMERIC
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT (_points::numeric / 100.0) * (public.gcfg('reward.conversion_rate_usd_per_100')::text)::numeric
$$;

-- Level compute
CREATE OR REPLACE FUNCTION public.user_levels_recompute(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _verified INT;
  _thr JSONB;
  _level TEXT := 'bronze';
BEGIN
  SELECT count(*) INTO _verified FROM public.referrals WHERE referrer_id=_user AND status='verified';
  _thr := public.gcfg('level.thresholds');
  IF _verified >= (_thr->>'diamond')::int THEN _level := 'diamond';
  ELSIF _verified >= (_thr->>'platinum')::int THEN _level := 'platinum';
  ELSIF _verified >= (_thr->>'gold')::int THEN _level := 'gold';
  ELSIF _verified >= (_thr->>'silver')::int THEN _level := 'silver';
  END IF;
  INSERT INTO public.user_levels(user_id, level, verified_referrals, updated_at)
  VALUES(_user, _level, _verified, now())
  ON CONFLICT (user_id) DO UPDATE SET level=EXCLUDED.level, verified_referrals=EXCLUDED.verified_referrals, updated_at=now();
END $$;

-- Wallet credit (internal, security definer)
CREATE OR REPLACE FUNCTION public._wallet_credit(_user UUID, _points INT, _bucket TEXT, _kind TEXT, _ref_id UUID, _ref_type TEXT, _desc TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _wid UUID; _usd NUMERIC;
BEGIN
  PERFORM public.ensure_growth_bootstrap(_user);
  SELECT id INTO _wid FROM public.wallets WHERE user_id=_user;
  _usd := public.points_to_usd(_points);

  UPDATE public.wallets SET
    balance = balance + _points,
    lifetime_earnings = lifetime_earnings + _points,
    referral_earnings = referral_earnings + CASE WHEN _bucket='referral' THEN _points ELSE 0 END,
    action_earnings   = action_earnings   + CASE WHEN _bucket='action' THEN _points ELSE 0 END,
    sales_earnings    = sales_earnings    + CASE WHEN _bucket='sales' THEN _points ELSE 0 END,
    bonus_earnings    = bonus_earnings    + CASE WHEN _bucket='bonus' THEN _points ELSE 0 END,
    updated_at = now()
  WHERE id=_wid;

  INSERT INTO public.wallet_ledger(wallet_id, user_id, direction, bucket, points, usd_equiv, kind, reference_id, reference_type, description)
  VALUES (_wid, _user, 'credit', _bucket, _points, _usd, _kind, _ref_id, _ref_type, _desc);
END $$;

-- Fraud analyzer
CREATE OR REPLACE FUNCTION public._analyze_fraud(_referral_id UUID)
RETURNS TABLE(score INT, level TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _ref RECORD;
  _score INT := 0;
  _dup_ip INT := 0;
  _dup_fp INT := 0;
  _self BOOL := false;
  _thr_m INT; _thr_h INT;
  _lvl TEXT;
BEGIN
  SELECT * INTO _ref FROM public.referrals WHERE id=_referral_id;
  IF _ref.referrer_id = _ref.referred_user_id THEN _self := true; _score := _score + 100; END IF;
  IF _ref.device_fingerprint IS NOT NULL THEN
    SELECT count(*) INTO _dup_fp FROM public.referrals
     WHERE device_fingerprint=_ref.device_fingerprint AND id<>_ref.id;
    _score := _score + LEAST(_dup_fp*25, 60);
  END IF;
  IF _ref.ip_address IS NOT NULL THEN
    SELECT count(*) INTO _dup_ip FROM public.referrals
     WHERE ip_address=_ref.ip_address AND referrer_id=_ref.referrer_id AND id<>_ref.id;
    _score := _score + LEAST(_dup_ip*10, 30);
  END IF;
  _thr_m := (public.gcfg('fraud.threshold_medium')::text)::int;
  _thr_h := (public.gcfg('fraud.threshold_high')::text)::int;
  _lvl := CASE WHEN _score >= _thr_h THEN 'high' WHEN _score >= _thr_m THEN 'medium' ELSE 'low' END;

  INSERT INTO public.fraud_signals(referral_id, user_id, device_fingerprint, ip, is_self_referral, score, level)
  VALUES(_referral_id, _ref.referrer_id, _ref.device_fingerprint, _ref.ip_address, _self, _score, _lvl);

  UPDATE public.referrals SET fraud_score=_score, fraud_level=_lvl WHERE id=_referral_id;
  RETURN QUERY SELECT _score, _lvl;
END $$;

-- Reward engine — single entry point for all rewards
CREATE OR REPLACE FUNCTION public.reward_engine_credit(
  _user UUID, _kind TEXT, _points INT, _source_user UUID DEFAULT NULL,
  _reference JSONB DEFAULT NULL, _fraud_score INT DEFAULT 0, _fraud_level TEXT DEFAULT 'low'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _claim_id UUID; _status TEXT; _auto_approve BOOL;
BEGIN
  IF _points IS NULL OR _points <= 0 THEN RETURN NULL; END IF;
  _auto_approve := _fraud_level = 'low' AND _kind IN ('action','commission','bonus');
  _status := CASE WHEN _fraud_level='high' THEN 'rejected'
                  WHEN _auto_approve THEN 'auto_approved'
                  ELSE 'pending' END;
  INSERT INTO public.reward_claims(user_id, source_user_id, kind, points, status, fraud_score, fraud_level, reference,
                                   rejection_reason, reviewed_at)
  VALUES (_user, _source_user, _kind, _points, _status, _fraud_score, _fraud_level, _reference,
          CASE WHEN _status='rejected' THEN 'Fraud detected' ELSE NULL END,
          CASE WHEN _status IN ('auto_approved','rejected') THEN now() ELSE NULL END)
  RETURNING id INTO _claim_id;

  IF _status='auto_approved' THEN
    PERFORM public._wallet_credit(_user, _points,
      CASE WHEN _kind IN ('seller_referral','buyer_referral','commission') THEN 'referral'
           WHEN _kind='action' THEN 'action'
           WHEN _kind='bonus' THEN 'bonus'
           ELSE 'action' END,
      _kind, _claim_id, 'reward_claim', 'Auto-approved '||_kind);
  END IF;
  RETURN _claim_id;
END $$;

-- Admin: approve claim
CREATE OR REPLACE FUNCTION public.reward_claim_approve(_claim_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _c RECORD; _bucket TEXT; _referrer UUID; _pct NUMERIC; _commission INT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO _c FROM public.reward_claims WHERE id=_claim_id FOR UPDATE;
  IF _c.status NOT IN ('pending') THEN RAISE EXCEPTION 'claim not pending'; END IF;

  _bucket := CASE WHEN _c.kind IN ('seller_referral','buyer_referral','commission') THEN 'referral'
                  WHEN _c.kind='action' THEN 'action'
                  WHEN _c.kind='bonus' THEN 'bonus'
                  ELSE 'action' END;
  PERFORM public._wallet_credit(_c.user_id, _c.points, _bucket, _c.kind, _c.id, 'reward_claim', 'Approved '||_c.kind);
  UPDATE public.reward_claims SET status='approved', reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_claim_id;
  PERFORM public.user_levels_recompute(_c.user_id);

  -- Level-1 commission on referral rewards
  IF _c.kind IN ('seller_referral','buyer_referral') AND _c.source_user_id IS NOT NULL THEN
    SELECT referrer_id INTO _referrer FROM public.referrals
      WHERE referred_user_id=_c.source_user_id AND status='verified'
      ORDER BY created_at DESC LIMIT 1;
    IF _referrer IS NOT NULL AND _referrer <> _c.user_id THEN
      -- referrer of the earner? no — the earner IS the referrer for referral rewards.
      -- commission is issued to the earner's own referrer if they have one.
      SELECT referrer_id INTO _referrer FROM public.referrals
        WHERE referred_user_id=_c.user_id AND status='verified' ORDER BY created_at DESC LIMIT 1;
      IF _referrer IS NOT NULL THEN
        _pct := (public.gcfg('reward.commission_pct')::text)::numeric;
        _commission := floor(_c.points * _pct / 100.0)::int;
        IF _commission > 0 THEN
          PERFORM public.reward_engine_credit(_referrer, 'commission', _commission, _c.user_id,
                     jsonb_build_object('parent_claim', _c.id), 0, 'low');
        END IF;
      END IF;
    END IF;
  END IF;
END $$;

-- Admin: reject claim
CREATE OR REPLACE FUNCTION public.reward_claim_reject(_claim_id UUID, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.reward_claims
     SET status='rejected', rejection_reason=_reason, reviewed_by=auth.uid(), reviewed_at=now()
   WHERE id=_claim_id AND status='pending';
END $$;

-- Growth event recorder (RPC callable from client)
CREATE OR REPLACE FUNCTION public.record_growth_event(_event TEXT, _entity_id UUID DEFAULT NULL, _entity_type TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _weights JSONB; _w INT; _uid UUID := auth.uid();
        _ref RECORD; _thr INT; _new_score INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  _weights := public.gcfg('growth.event_weights');
  _w := COALESCE((_weights->>_event)::int, 0);
  IF _w <= 0 THEN RETURN; END IF;
  INSERT INTO public.growth_events(user_id, event_type, weight, entity_id, entity_type)
  VALUES(_uid, _event, _w, _entity_id, _entity_type)
  ON CONFLICT DO NOTHING;

  -- Update referral score if this user was referred as buyer
  SELECT * INTO _ref FROM public.referrals
    WHERE referred_user_id=_uid AND type='buyer' AND status IN ('pending','qualifying') LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE(sum(weight),0) INTO _new_score FROM public.growth_events WHERE user_id=_uid;
  UPDATE public.referrals SET growth_score=_new_score,
                              status = CASE WHEN status='pending' THEN 'qualifying' ELSE status END
   WHERE id=_ref.id;

  _thr := (public.gcfg('growth.buyer_threshold')::text)::int;
  IF _new_score >= _thr THEN
    PERFORM public._qualify_buyer_referral(_ref.id);
  END IF;
END $$;

-- Qualify buyer referral
CREATE OR REPLACE FUNCTION public._qualify_buyer_referral(_ref_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _r RECORD; _pts INT; _f RECORD;
BEGIN
  SELECT * INTO _r FROM public.referrals WHERE id=_ref_id FOR UPDATE;
  IF _r.status = 'verified' THEN RETURN; END IF;
  SELECT * INTO _f FROM public._analyze_fraud(_ref_id) LIMIT 1;
  IF _f.level = 'high' THEN
    UPDATE public.referrals SET status='rejected', rejection_reason='Fraud detected' WHERE id=_ref_id;
    RETURN;
  END IF;
  UPDATE public.referrals SET status='verified', is_valid=true, qualified_at=now(), validated_at=now() WHERE id=_ref_id;
  _pts := (public.gcfg('reward.buyer_referral')::text)::int;
  PERFORM public.reward_engine_credit(_r.referrer_id, 'buyer_referral', _pts, _r.referred_user_id,
    jsonb_build_object('referral_id', _ref_id), _f.score, _f.level);
END $$;

-- Qualify seller referral (invoked by trigger checks)
CREATE OR REPLACE FUNCTION public._qualify_seller_referral(_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _r RECORD; _p RECORD; _has_product BOOL; _pts INT; _f RECORD;
BEGIN
  SELECT * INTO _r FROM public.referrals WHERE referred_user_id=_user AND type='seller' AND status IN ('pending','qualifying') LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT identity_verified, phone_number, email, full_name, status INTO _p FROM public.profiles WHERE id=_user;
  IF _p IS NULL THEN RETURN; END IF;
  IF NOT COALESCE(_p.identity_verified,false) THEN RETURN; END IF;
  IF _p.phone_number IS NULL OR _p.email IS NULL OR _p.full_name IS NULL THEN RETURN; END IF;
  IF COALESCE(_p.status,'active') <> 'active' THEN RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.products WHERE user_id=_user AND status='approved') INTO _has_product;
  IF NOT _has_product THEN RETURN; END IF;

  SELECT * INTO _f FROM public._analyze_fraud(_r.id) LIMIT 1;
  IF _f.level='high' THEN
    UPDATE public.referrals SET status='rejected', rejection_reason='Fraud detected' WHERE id=_r.id;
    RETURN;
  END IF;
  UPDATE public.referrals SET status='verified', is_valid=true, qualified_at=now(), validated_at=now() WHERE id=_r.id;
  _pts := (public.gcfg('reward.seller_referral')::text)::int;
  PERFORM public.reward_engine_credit(_r.referrer_id, 'seller_referral', _pts, _user,
    jsonb_build_object('referral_id', _r.id), _f.score, _f.level);
END $$;

-- Trigger: check seller qualification on profile / identity / product change
CREATE OR REPLACE FUNCTION public.tg_check_seller_referral() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid UUID;
BEGIN
  _uid := COALESCE(NEW.user_id, NEW.id);
  PERFORM public._qualify_seller_referral(_uid);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seller_ref_profile ON public.profiles;
CREATE TRIGGER trg_seller_ref_profile AFTER UPDATE ON public.profiles
FOR EACH ROW WHEN (NEW.identity_verified IS DISTINCT FROM OLD.identity_verified
                OR NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.tg_check_seller_referral();

DROP TRIGGER IF EXISTS trg_seller_ref_product ON public.products;
CREATE TRIGGER trg_seller_ref_product AFTER INSERT OR UPDATE OF status ON public.products
FOR EACH ROW WHEN (NEW.status='approved')
EXECUTE FUNCTION public.tg_check_seller_referral();

-- Withdrawal creation RPC
CREATE OR REPLACE FUNCTION public.withdrawal_create(_points INT, _method TEXT, _payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid UUID := auth.uid(); _p RECORD; _w RECORD; _min INT; _rate NUMERIC;
        _usd NUMERIC; _country TEXT; _methods JSONB; _wid UUID;
        _pending INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _p FROM public.profiles WHERE id=_uid;
  IF NOT COALESCE(_p.identity_verified,false) THEN RAISE EXCEPTION 'Identity not verified'; END IF;
  IF _p.phone_number IS NULL THEN RAISE EXCEPTION 'Phone not verified'; END IF;

  _country := COALESCE(_p.country_code, _p.country);
  IF upper(COALESCE(_country,'')) IN ('RW','RWANDA') THEN
    _methods := public.gcfg('payout.rwanda_methods');
  ELSE
    _methods := public.gcfg('payout.global_methods');
  END IF;
  IF NOT (_methods ? _method) THEN RAISE EXCEPTION 'Payout method not available in your country'; END IF;

  _min := (public.gcfg('reward.min_withdrawal')::text)::int;
  IF _points < _min THEN RAISE EXCEPTION 'Below minimum withdrawal (%)', _min; END IF;

  SELECT * INTO _w FROM public.wallets WHERE user_id=_uid FOR UPDATE;
  IF _w.balance < _points THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  SELECT count(*) INTO _pending FROM public.withdrawals WHERE user_id=_uid AND status IN ('pending','approved');
  IF _pending > 0 THEN RAISE EXCEPTION 'You have a pending withdrawal'; END IF;

  _rate := (public.gcfg('reward.conversion_rate_usd_per_100')::text)::numeric;
  _usd := (_points::numeric / 100.0) * _rate;

  UPDATE public.wallets SET balance = balance - _points, pending_balance = pending_balance + _points, updated_at=now()
   WHERE id=_w.id;

  INSERT INTO public.wallet_ledger(wallet_id, user_id, direction, bucket, points, usd_equiv, kind, reference_type, description, status)
  VALUES(_w.id, _uid, 'debit', 'withdrawal_hold', _points, _usd, 'withdrawal', 'withdrawal', 'Withdrawal hold', 'pending');

  INSERT INTO public.withdrawals(user_id, points, usd_amount, conversion_rate_snapshot, method, payload, country, status)
  VALUES(_uid, _points, _usd, _rate, _method, _payload, _country, 'pending')
  RETURNING id INTO _wid;
  RETURN _wid;
END $$;

-- Admin withdrawal actions
CREATE OR REPLACE FUNCTION public.withdrawal_approve(_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.withdrawals SET status='approved', approved_at=now(), reviewed_by=auth.uid(), updated_at=now()
   WHERE id=_id AND status='pending';
END $$;

CREATE OR REPLACE FUNCTION public.withdrawal_mark_paid(_id UUID, _reference TEXT DEFAULT NULL, _note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _w RECORD; _wallet RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id=_id FOR UPDATE;
  IF _w.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'invalid state'; END IF;
  SELECT * INTO _wallet FROM public.wallets WHERE user_id=_w.user_id FOR UPDATE;
  UPDATE public.wallets SET pending_balance = pending_balance - _w.points,
                            total_withdrawn = total_withdrawn + _w.points,
                            updated_at = now()
   WHERE id=_wallet.id;
  INSERT INTO public.wallet_ledger(wallet_id, user_id, direction, bucket, points, usd_equiv, kind, reference_id, reference_type, description, status)
  VALUES(_wallet.id, _w.user_id, 'debit', 'withdrawal', _w.points, _w.usd_amount, 'withdrawal', _w.id, 'withdrawal',
         COALESCE('Paid via '||_w.method,'Withdrawal paid'), 'completed');
  UPDATE public.withdrawals SET status='paid', paid_at=now(), paid_reference=_reference, admin_note=COALESCE(_note, admin_note), updated_at=now() WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.withdrawal_reject(_id UUID, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _w RECORD; _wallet RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id=_id FOR UPDATE;
  IF _w.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'invalid state'; END IF;
  SELECT * INTO _wallet FROM public.wallets WHERE user_id=_w.user_id FOR UPDATE;
  -- refund hold back to available
  UPDATE public.wallets SET balance = balance + _w.points,
                            pending_balance = pending_balance - _w.points,
                            updated_at=now()
   WHERE id=_wallet.id;
  INSERT INTO public.wallet_ledger(wallet_id, user_id, direction, bucket, points, usd_equiv, kind, reference_id, reference_type, description)
  VALUES(_wallet.id, _w.user_id, 'credit', 'withdrawal_refund', _w.points, _w.usd_amount, 'withdrawal_refund', _w.id, 'withdrawal', 'Withdrawal rejected — refund');
  UPDATE public.withdrawals SET status='rejected', rejection_reason=_reason, reviewed_by=auth.uid(), updated_at=now() WHERE id=_id;
END $$;

-- Bootstrap on new profile
CREATE OR REPLACE FUNCTION public.tg_profile_growth_bootstrap() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.ensure_growth_bootstrap(NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profile_growth_bootstrap ON public.profiles;
CREATE TRIGGER trg_profile_growth_bootstrap AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profile_growth_bootstrap();

-- Backfill existing profiles
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.ensure_growth_bootstrap(r.id);
  END LOOP;
END $$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.record_growth_event(TEXT,UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_create(INT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reward_claim_approve(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reward_claim_reject(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_approve(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_mark_paid(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdrawal_reject(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gcfg(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.points_to_usd(INT) TO anon, authenticated;
