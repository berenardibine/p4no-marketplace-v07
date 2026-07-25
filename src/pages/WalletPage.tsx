import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWallet, useWithdrawals, useGrowthConfig } from "@/hooks/useGrowth";
import WithdrawSheet from "@/components/wallet/WithdrawSheet";

const WalletPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wallet } = useWallet();
  const { items: withdrawals, refresh } = useWithdrawals();
  const config = useGrowthConfig();
  const [ledger, setLedger] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const rate = Number(config["reward.conversion_rate_usd_per_100"] ?? 0.5);

  useEffect(() => {
    if (!user) return;
    supabase.from("wallet_ledger").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setLedger(data || []));
  }, [user, wallet]);

  if (!user) { navigate("/auth"); return null; }
  const available = wallet?.balance || 0;
  const usd = ((available / 100) * rate).toFixed(2);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-lg font-semibold">Wallet</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <Card className="p-5 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-1"><WalletIcon className="w-4 h-4" /><span className="text-xs uppercase tracking-wide">Available</span></div>
          <div className="text-4xl font-bold">{available} <span className="text-lg font-medium text-muted-foreground">pts</span></div>
          <div className="text-sm text-muted-foreground mt-1">≈ ${usd} USD</div>
          <Button className="w-full mt-4" size="lg" onClick={() => setOpen(true)}>Withdraw</Button>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Mini label="Pending" value={wallet?.pending_balance || 0} />
          <Mini label="Lifetime" value={wallet?.lifetime_earnings || 0} />
          <Mini label="Withdrawn" value={wallet?.total_withdrawn || 0} />
          <Mini label="Referral" value={wallet?.referral_earnings || 0} />
          <Mini label="Action" value={wallet?.action_earnings || 0} />
          <Mini label="Bonus" value={wallet?.bonus_earnings || 0} />
        </div>

        <Tabs defaultValue="ledger">
          <TabsList className="w-full"><TabsTrigger value="ledger" className="flex-1">Ledger</TabsTrigger><TabsTrigger value="withdrawals" className="flex-1">Withdrawals</TabsTrigger></TabsList>
          <TabsContent value="ledger" className="space-y-2 mt-3">
            {ledger.length === 0 && <p className="text-sm text-center text-muted-foreground py-8">No transactions yet</p>}
            {ledger.map(l => (
              <Card key={l.id} className="p-3 flex items-center gap-3">
                {l.direction === "credit"
                  ? <ArrowDownLeft className="w-4 h-4 text-green-500" />
                  : <ArrowUpRight className="w-4 h-4 text-red-500" />}
                <div className="flex-1 text-sm">
                  <div className="capitalize">{(l.description || l.kind || "").replace(/_/g," ")}</div>
                  <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()} · {l.bucket}</div>
                </div>
                <div className={`font-bold ${l.direction === "credit" ? "text-green-500" : "text-red-500"}`}>
                  {l.direction === "credit" ? "+" : "-"}{l.points}
                </div>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="withdrawals" className="space-y-2 mt-3">
            {withdrawals.length === 0 && <p className="text-sm text-center text-muted-foreground py-8">No withdrawals yet</p>}
            {withdrawals.map(w => (
              <Card key={w.id} className="p-3 flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 text-sm">
                  <div className="capitalize">{w.method} · {w.points} pts (${Number(w.usd_amount).toFixed(2)})</div>
                  <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
                  {w.rejection_reason && <div className="text-xs text-red-500">{w.rejection_reason}</div>}
                </div>
                <Badge variant="outline" className="capitalize">{w.status}</Badge>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <WithdrawSheet open={open} onOpenChange={setOpen} onSubmitted={refresh} />
    </div>
  );
};

const Mini = ({ label, value }: { label: string; value: number }) => (
  <Card className="p-3 text-center">
    <div className="text-lg font-bold">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </Card>
);

export default WalletPage;
