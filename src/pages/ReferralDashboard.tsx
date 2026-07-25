import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Share2, Trophy, Users, CheckCircle2, Clock, XCircle, TrendingUp, Wallet, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useReferralStats, useRewardClaims, useUserLevel, useWallet, useGrowthConfig } from "@/hooks/useGrowth";
import { toast } from "sonner";

const LEVEL_COLORS: Record<string, string> = {
  bronze: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  silver: "bg-slate-400/15 text-slate-400 border-slate-400/30",
  gold: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  platinum: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
  diamond: "bg-purple-500/15 text-purple-500 border-purple-500/30",
};

const ReferralDashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { wallet } = useWallet();
  const stats = useReferralStats();
  const claims = useRewardClaims();
  const level = useUserLevel();
  const config = useGrowthConfig();
  const [copied, setCopied] = useState(false);

  const code = profile?.referral_code || "";
  const link = useMemo(() => `${window.location.origin}/r/${code}`, [code]);

  if (!user) { navigate("/auth"); return null; }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const share = (platform: string) => {
    const msg = `Join P4NO with my referral link: ${link}`;
    const enc = encodeURIComponent(msg);
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${enc}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${enc}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      x: `https://twitter.com/intent/tweet?text=${enc}`,
      email: `mailto:?subject=${encodeURIComponent("Join P4NO")}&body=${enc}`,
    };
    if (navigator.share && platform === "native") {
      navigator.share({ title: "P4NO", text: msg, url: link }).catch(() => {});
      return;
    }
    window.open(urls[platform], "_blank");
  };

  const referralEarnings = wallet?.referral_earnings || 0;
  const actionEarnings = wallet?.action_earnings || 0;
  const lifetime = wallet?.lifetime_earnings || 0;
  const available = wallet?.balance || 0;
  const pending = wallet?.pending_balance || 0;
  const commissionPct = config["reward.commission_pct"] ?? 10;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-lg font-semibold">Referrals & Rewards</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Level card */}
        <Card className="p-4 flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full border flex items-center justify-center ${LEVEL_COLORS[level?.level || "bronze"]}`}>
            <Trophy className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Your level</div>
            <div className="text-lg font-bold capitalize">{level?.level || "bronze"}</div>
            <div className="text-xs text-muted-foreground">{level?.verified_referrals || 0} verified referrals · {commissionPct}% commission</div>
          </div>
          <Link to="/leaderboard"><Button variant="outline" size="sm">Leaderboard</Button></Link>
        </Card>

        {/* QR + Link */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="p-3 bg-white rounded-lg">
              <QRCodeCanvas value={link} size={128} />
            </div>
            <div className="flex-1 w-full space-y-2">
              <div className="text-xs text-muted-foreground">Your referral code</div>
              <div className="flex gap-2">
                <div className="flex-1 font-mono font-bold text-lg bg-muted rounded px-3 py-2 text-center">{code}</div>
                <Button size="icon" variant="outline" onClick={() => copy(code)}><Copy className="w-4 h-4" /></Button>
              </div>
              <div className="text-xs text-muted-foreground">Your referral link</div>
              <div className="flex gap-2">
                <div className="flex-1 text-xs bg-muted rounded px-3 py-2 truncate">{link}</div>
                <Button size="icon" variant="outline" onClick={() => copy(link)}><Copy className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-5 gap-1 pt-2">
                {["whatsapp","telegram","facebook","x","email"].map(p => (
                  <Button key={p} variant="outline" size="sm" onClick={() => share(p)} className="text-xs capitalize">{p}</Button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Wallet mini */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4" /><span className="font-semibold text-sm">Wallet</span>
            <Link to="/wallet" className="ml-auto text-xs text-primary">Open →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Available" value={`${available} pts`} accent />
            <Stat label="Pending" value={`${pending} pts`} />
            <Stat label="Referral earnings" value={`${referralEarnings} pts`} />
            <Stat label="Action earnings" value={`${actionEarnings} pts`} />
            <Stat label="Lifetime earnings" value={`${lifetime} pts`} />
            <Stat label="Withdrawn" value={`${wallet?.total_withdrawn || 0} pts`} />
          </div>
        </Card>

        {/* Referral stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatIcon icon={Users} label="Total" value={stats.total} />
          <StatIcon icon={CheckCircle2} label="Verified" value={stats.verified} tone="text-green-500" />
          <StatIcon icon={Clock} label="Pending" value={stats.pending} tone="text-orange-500" />
          <StatIcon icon={XCircle} label="Rejected" value={stats.rejected} tone="text-red-500" />
        </div>
        <Card className="p-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm">Conversion rate</span>
          <span className="ml-auto font-bold">{stats.conversion}%</span>
        </Card>

        {/* History */}
        <Tabs defaultValue="referrals">
          <TabsList className="w-full">
            <TabsTrigger value="referrals" className="flex-1">Referrals</TabsTrigger>
            <TabsTrigger value="rewards" className="flex-1">Rewards</TabsTrigger>
          </TabsList>
          <TabsContent value="referrals" className="space-y-2 mt-3">
            {stats.rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No referrals yet — share your link</p>}
            {stats.rows.map(r => (
              <Card key={r.id} className="p-3 flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{r.type || "buyer"}</Badge>
                <div className="text-xs flex-1">
                  <div className="capitalize">{r.status}</div>
                  {r.status === "qualifying" && <div className="text-muted-foreground">Score {r.growth_score}</div>}
                  {r.rejection_reason && <div className="text-red-500">{r.rejection_reason}</div>}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="rewards" className="space-y-2 mt-3">
            {claims.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No rewards yet</p>}
            {claims.map(c => (
              <Card key={c.id} className="p-3 flex items-center gap-2">
                <div className="flex-1 text-sm">
                  <div className="capitalize font-medium">{c.kind.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground capitalize">{c.status.replace("_", " ")}</div>
                  {c.rejection_reason && <div className="text-xs text-red-500">{c.rejection_reason}</div>}
                </div>
                <div className={`font-bold ${c.status === "rejected" ? "line-through opacity-50" : ""}`}>+{c.points}</div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-lg p-3 ${accent ? "bg-primary/10 border border-primary/20" : "bg-muted"}`}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
  </div>
);

const StatIcon = ({ icon: Icon, label, value, tone }: any) => (
  <Card className="p-3 text-center">
    <Icon className={`w-5 h-5 mx-auto mb-1 ${tone || "text-muted-foreground"}`} />
    <div className="text-xl font-bold">{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </Card>
);

export default ReferralDashboard;
