import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Coins, BadgeCheck, Users, Eye, AlertTriangle,
  Share2, Sparkles, Clock, Trophy, TrendingUp, Gift
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useMyProducts } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";

const SellerMonetization = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { products } = useMyProducts();

  // Calculate stats (placeholder values for demo)
  const totalViews = products.reduce((sum, p) => sum + (p.views || 0), 0);
  const isVerified = (profile as any)?.identity_verified || false;
  const hasWarnings = profile?.status === 'warned';
  const connectorsCount = 0; // Would come from actual data

  const requirements = [
    {
      icon: Users,
      title: "number of connectors (followers)",
      description: "Build your audience to qualify",
      current: connectorsCount,
      target: 500,
      completed: connectorsCount >= 500,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: BadgeCheck,
      title: "Identity verified by p4no",
      description: "Verify your identity to unlock monetization",
      current: isVerified ? 1 : 0,
      target: 1,
      completed: isVerified,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      icon: Eye,
      title: "Number of total product views",
      description: "Get more views on your products by share your product on social media and envites people to visit your product",
      current: totalViews,
      target: 50000,
      completed: totalViews >= 50000,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: AlertTriangle,
      title: "No warnings or violations",
      description: "Maintain a clean account record",
      current: hasWarnings ? 0 : 1,
      target: 1,
      completed: !hasWarnings,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  const completedCount = requirements.filter(r => r.completed).length;
  const progressPercent = (completedCount / requirements.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 pb-8">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary to-orange-500">
        <div className="flex items-center gap-3 p-4 text-white">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Seller Monetization</h1>
            <p className="text-white/80 text-sm">earn from your trading</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <Coins className="h-6 w-6" />
          </div>
        </div>
        
        {/* Coming Soon Banner */}
        <div className="bg-white/10 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 animate-spin" style={{ animationDuration: '3s' }} />
          <span className="text-sm font-medium">Under Construction</span>
          <span className="text-xs opacity-75">• Launching Soon</span>
        </div>
      </div>

      <div className="container px-4 py-6 space-y-6">
        {/* Hero Card */}
        <div className="bg-gradient-to-br from-primary/10 via-orange-50 to-amber-50 rounded-3xl p-6 border border-primary/20 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-lg shadow-primary/30">
              <Coins className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground mb-1">
                💰 Seller Monetization Program
              </h2>
              <p className="text-muted-foreground text-sm">
                Earn from your activity once monetization is live!
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white/50 rounded-2xl border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="font-semibold">Status: Under Construction</span>
            </div>
            <p className="text-sm text-muted-foreground">
               Monetization for sellers is currently under construction. 
              Once the system is live, qualified sellers will receive payments 
              directly from p4no based on their performance.
            </p>
          </div>
        </div>

        {/* Progress Overview */}
        <div className="bg-white rounded-2xl p-5 border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Qualification Progress</h3>
            <span className="text-primary font-bold">{completedCount}/{requirements.length}</span>
          </div>
          <Progress value={progressPercent} className="h-3 mb-4" />
          <p className="text-sm text-muted-foreground">
            Complete all requirements to qualify for monetization when it launches.
          </p>
        </div>

        {/* Requirements */}
        <div className="bg-white rounded-2xl p-5 border shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Qualification Requirements
          </h3>
          <div className="space-y-4">
            {requirements.map((req, idx) => (
              <div 
                key={idx}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-2xl transition-all",
                  req.completed ? "bg-green-50 border border-green-200" : "bg-muted/30"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  req.bgColor
                )}>
                  <req.icon className={cn("h-6 w-6", req.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{req.title}</h4>
                    {req.completed && (
                      <BadgeCheck className="h-4 w-4 text-green-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{req.description}</p>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={Math.min((req.current / req.target) * 100, 100)} 
                      className="h-2 flex-1" 
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {req.current}/{req.target}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Motivation Panel */}
        <div className="bg-gradient-to-r from-primary to-orange-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5" />
            <h3 className="font-bold">Want to increase your chances?</h3>
          </div>
          <ul className="space-y-2 mb-6 text-sm opacity-90">
            <li className="flex items-start gap-2">
              <span className="text-amber-300">🔸</span>
              Share your products on social media to gain more views and connectors.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-300">🔸</span>
              Verified and active sellers will be prioritized once monetization starts.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-300">🔸</span>
              Keep uploading quality products to boost your visibility.
            </li>
          </ul>
          <Button 
            onClick={() => navigate('/seller-dashboard')}
            className="w-full bg-white text-primary hover:bg-white/90 gap-2"
          >
            <Share2 className="h-5 w-5" />
            Share Your Products on Social Media
          </Button>
        </div>

        {/* Benefits Card */}
        <div className="bg-white rounded-2xl p-5 border shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Coming Benefits
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
              <TrendingUp className="h-6 w-6 text-green-500 mb-2" />
              <h4 className="font-medium text-sm">Performance Pay</h4>
              <p className="text-xs text-muted-foreground">Earn based on views & sales</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200">
              <Users className="h-6 w-6 text-blue-500 mb-2" />
              <h4 className="font-medium text-sm">Connector Bonus</h4>
              <p className="text-xs text-muted-foreground">Get paid for followers</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200">
              <BadgeCheck className="h-6 w-6 text-purple-500 mb-2" />
              <h4 className="font-medium text-sm">Verified Perks</h4>
              <p className="text-xs text-muted-foreground">Priority in search results</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
              <Coins className="h-6 w-6 text-amber-500 mb-2" />
              <h4 className="font-medium text-sm">Monthly Payout</h4>
              <p className="text-xs text-muted-foreground">Direct bank transfer</p>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="bg-muted/50 rounded-2xl p-4 border">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">
                🕒 p4no is preparing a fair monetization system that rewards sellers 
                for their effort, engagement, and visibility.
              </p>
              <p className="text-sm text-primary font-medium mt-2">
                Keep growing your audience — once we launch monetization, you'll be among the first to apply! 🚀
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerMonetization;
