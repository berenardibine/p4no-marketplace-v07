import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Gift, Star, Zap, Ticket, ShoppingBag, 
  Percent, Clock, ChevronRight, Crown, TrendingUp, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useRewards, useLeaderboard } from "@/hooks/useRewards";
import { Skeleton } from "@/components/ui/skeleton";

const RewardsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userReward, loading } = useRewards();
  const { leaderboard, loading: loadingLeaderboard } = useLeaderboard();

  if (!user) {
    navigate('/auth');
    return null;
  }

  const currentPoints = userReward?.points || 0;
  const nextLevel = ((userReward?.level || 1) + 1) * 100;
  const progressToNextLevel = Math.min((currentPoints % 100), 100);

  const rewards = [
    {
      id: 1,
      title: "10% Off First Purchase",
      description: "Get 10% discount on your first order",
      points: 200,
      icon: Percent,
      color: "from-green-500 to-emerald-500",
      available: currentPoints >= 200
    },
    {
      id: 2,
      title: "Free Delivery",
      description: "Free delivery on any order",
      points: 350,
      icon: ShoppingBag,
      color: "from-blue-500 to-cyan-500",
      available: currentPoints >= 350
    },
    {
      id: 3,
      title: "VIP Badge",
      description: "Exclusive VIP member badge",
      points: 500,
      icon: Star,
      color: "from-amber-500 to-orange-500",
      available: currentPoints >= 500
    },
    {
      id: 4,
      title: "Premium for 1 Month",
      description: "Unlock premium features for 30 days",
      points: 1000,
      icon: Ticket,
      color: "from-purple-500 to-pink-500",
      available: currentPoints >= 1000
    },
  ];

  const getBadgeColor = (index: number) => {
    if (index === 0) return 'from-yellow-400 to-amber-500';
    if (index === 1) return 'from-gray-300 to-gray-400';
    if (index === 2) return 'from-amber-600 to-amber-700';
    return 'from-blue-400 to-blue-500';
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 via-primary to-rose-500 pt-safe pb-8">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg text-white">My Rewards</h1>
        </div>

        {/* Points Card */}
        <div className="px-4 mt-4">
          {loading ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : (
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/30 flex items-center justify-center">
                  <Gift className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white/80 text-sm">Available Points</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-white">{currentPoints}</span>
                    <Zap className="h-5 w-5 text-yellow-300" />
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-white text-primary">Level {userReward?.level || 1}</Badge>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-sm text-white/80 mb-2">
                  <span>Progress to next level</span>
                  <span>{progressToNextLevel}%</span>
                </div>
                <Progress value={progressToNextLevel} className="h-2 bg-white/30" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-4 grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border shadow-sm text-center">
          <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-1" />
          <p className="font-bold text-lg">{userReward?.streak_days || 0}</p>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </div>
        <div className="bg-card rounded-xl p-4 border shadow-sm text-center">
          <Star className="h-6 w-6 text-amber-500 mx-auto mb-1" />
          <p className="font-bold text-lg">{userReward?.coins || 0}</p>
          <p className="text-xs text-muted-foreground">Coins</p>
        </div>
      </div>

      {/* How to Earn */}
      <div className="p-4">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            How to Earn Points
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">+5</div>
              <span className="text-muted-foreground">Daily Login</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">+50</div>
              <span className="text-muted-foreground">Complete Challenge</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">+10</div>
              <span className="text-muted-foreground">Share Product</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">+25</div>
              <span className="text-muted-foreground">Post Product</span>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full mt-4"
            onClick={() => navigate('/challenges')}
          >
            View All Challenges
          </Button>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4 mb-4">
        <h3 className="font-semibold mb-3 flex items-center justify-between">
          <span>Leaderboard</span>
          <span className="text-xs text-muted-foreground">This Week</span>
        </h3>
        
        {loadingLeaderboard ? (
          <div className="space-y-2">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-6 bg-card rounded-xl border">
            <Crown className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No data yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map((entry, index) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border",
                  entry.user_id === user?.id ? 'bg-primary/5 border-primary/20' : 'bg-card'
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm",
                  getBadgeColor(index)
                )}>
                  {index < 3 ? <Award className="h-4 w-4" /> : index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {entry.profile?.full_name || 'Anonymous'}
                  </p>
                </div>
                <span className="font-bold text-primary">{entry.points || 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Rewards */}
      <div className="px-4">
        <h3 className="font-semibold mb-3">Redeem Rewards</h3>
        <div className="space-y-3">
          {rewards.map(reward => (
            <div 
              key={reward.id}
              className={cn(
                "bg-card rounded-2xl p-4 border flex items-center gap-4 transition-all",
                !reward.available && "opacity-50"
              )}
            >
              <div className={cn(
                "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center",
                reward.color
              )}>
                <reward.icon className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">{reward.title}</h4>
                <p className="text-sm text-muted-foreground">{reward.description}</p>
                <div className="flex items-center gap-1 mt-1 text-primary">
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-sm font-medium">{reward.points} points</span>
                </div>
              </div>
              <Button 
                size="sm" 
                disabled={!reward.available}
                className="rounded-xl"
              >
                Redeem
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RewardsPage;