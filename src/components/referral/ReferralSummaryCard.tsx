import { useNavigate } from "react-router-dom";
import { Gift, Users, Wallet, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet, useReferralStats, useGrowthConfig } from "@/hooks/useGrowth";

/**
 * Compact Referral & Rewards summary card for Buyer/Seller dashboards & Account page.
 * Reads live wallet + referral stats from existing backend.
 */
const ReferralSummaryCard = () => {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const stats = useReferralStats();
  const config = useGrowthConfig();

  const rate = Number(config["reward.conversion_rate_usd_per_100"] ?? 0.5);
  const points = wallet?.balance || 0;
  const pending = wallet?.pending_balance || 0;
  const usd = ((points / 100) * rate).toFixed(2);

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/10 via-orange-500/5 to-amber-500/5 border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
          <Gift className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">Refer & Earn</div>
          <div className="text-xs text-muted-foreground">Invite friends, earn points</div>
        </div>
        <Button size="sm" variant="ghost" className="text-primary" onClick={() => navigate("/referrals")}>
          Open <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => navigate("/wallet")} className="rounded-xl bg-background/60 p-2 text-left hover:bg-background transition-colors">
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="w-3 h-3" /> Points</div>
          <div className="font-bold">{points}</div>
          <div className="text-2xs text-muted-foreground">≈ ${usd}</div>
        </button>
        <button onClick={() => navigate("/referrals")} className="rounded-xl bg-background/60 p-2 text-left hover:bg-background transition-colors">
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3 h-3" /> Referrals</div>
          <div className="font-bold">{stats.total}</div>
          <div className="text-2xs text-muted-foreground">{stats.verified} verified</div>
        </button>
        <button onClick={() => navigate("/wallet")} className="rounded-xl bg-background/60 p-2 text-left hover:bg-background transition-colors">
          <div className="text-xs text-muted-foreground">Pending</div>
          <div className="font-bold">{pending}</div>
          <div className="text-2xs text-muted-foreground">rewards</div>
        </button>
      </div>

      <Button className="w-full mt-3" size="sm" onClick={() => navigate("/referrals")}>
        Open Referral Dashboard
      </Button>
    </Card>
  );
};

export default ReferralSummaryCard;
