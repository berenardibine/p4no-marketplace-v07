import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WalletSummary {
  id: string;
  balance: number;
  pending_balance: number;
  referral_earnings: number;
  action_earnings: number;
  sales_earnings: number;
  bonus_earnings: number;
  lifetime_earnings: number;
  total_withdrawn: number;
}

export interface RewardClaim {
  id: string;
  kind: string;
  points: number;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  points: number;
  usd_amount: number;
  method: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  rejection_reason: string | null;
}

export interface ReferralRow {
  id: string;
  referred_user_id: string;
  type: string | null;
  status: string;
  growth_score: number;
  rejection_reason: string | null;
  created_at: string;
}

export function useGrowthConfig() {
  const [config, setConfig] = useState<Record<string, any>>({});
  useEffect(() => {
    supabase.from("growth_config").select("key,value").then(({ data }) => {
      if (data) setConfig(Object.fromEntries(data.map((d: any) => [d.key, d.value])));
    });
  }, []);
  return config;
}

export function useWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setWallet(null); setLoading(false); return; }
    const { data } = await supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle();
    setWallet(data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);
  return { wallet, loading, refresh };
}

export function useReferralStats() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from("referrals").select("*").eq("referrer_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRows((data as any) || []); setLoading(false); });
  }, [user]);

  const total = rows.length;
  const verified = rows.filter(r => r.status === "verified").length;
  const pending = rows.filter(r => ["pending", "qualifying"].includes(r.status)).length;
  const rejected = rows.filter(r => r.status === "rejected").length;
  const conversion = total ? Math.round((verified / total) * 100) : 0;
  return { rows, loading, total, verified, pending, rejected, conversion };
}

export function useRewardClaims() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("reward_claims").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setClaims((data as any) || []));
  }, [user]);
  return claims;
}

export function useWithdrawals() {
  const { user } = useAuth();
  const [items, setItems] = useState<Withdrawal[]>([]);
  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("withdrawals").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(50);
    setItems((data as any) || []);
  }, [user]);
  useEffect(() => { refresh(); }, [refresh]);
  return { items, refresh };
}

export function useUserLevel() {
  const { user } = useAuth();
  const [level, setLevel] = useState<{ level: string; verified_referrals: number } | null>(null);
  useEffect(() => {
    if (!user) return;
    supabase.from("user_levels").select("level,verified_referrals").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setLevel(data as any));
  }, [user]);
  return level;
}

export async function recordGrowthEvent(event: string, entityId?: string, entityType?: string) {
  try {
    await supabase.rpc("record_growth_event", {
      _event: event,
      _entity_id: entityId ?? null,
      _entity_type: entityType ?? null,
    } as any);
  } catch (e) {
    // silent
  }
}
