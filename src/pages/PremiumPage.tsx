import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Crown, Check, Zap, Star, Shield, 
  Rocket, Gift, BadgeCheck, Sparkles, Eye, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePlans, useUserSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const PremiumPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plans, loading } = usePlans();
  const { subscription, isPremium } = useUserSubscription();
  const { toast } = useToast();

  const features = [
    { icon: Rocket, text: "Priority listing in search results" },
    { icon: Shield, text: "Verified seller badge" },
    { icon: Star, text: "Unlimited product posts" },
    { icon: Eye, text: "Product highlighting" },
    { icon: BarChart3, text: "Advanced analytics dashboard" },
    { icon: BadgeCheck, text: "Priority customer support" },
  ];

  const handleSubscribe = (planId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    // TODO: Integrate payment gateway (Stripe/Flutterwave)
    toast({
      title: "Coming Soon",
      description: "Payment integration will be available soon!",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-RW', {
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-primary pt-safe pb-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 left-10 w-24 h-24 rounded-full bg-white/10 blur-xl" />
        
        <div className="flex items-center gap-3 p-4 relative">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg text-white">Premium</h1>
        </div>

        {isPremium && subscription ? (
          <div className="px-4 relative">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-4">
              <Crown className="h-10 w-10 text-yellow-300" />
              <div>
                <p className="font-bold text-white">You're Premium!</p>
                <p className="text-white/80 text-sm">
                  {subscription.expires_at 
                    ? `Expires ${format(new Date(subscription.expires_at), 'MMM d, yyyy')}`
                    : 'Active subscription'
                  }
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center mt-6 px-4 relative">
            <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm mx-auto flex items-center justify-center mb-4">
              <Crown className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Go Premium</h2>
            <p className="text-white/80 mt-2">Unlock exclusive features and grow your business</p>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-card rounded-2xl p-5 border shadow-lg">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Premium Features
          </h3>
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <feature.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="p-4 space-y-3 mt-4">
        <h3 className="font-semibold">Choose Your Plan</h3>
        
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          // Fallback plans if none in database
          <>
            {[
              { name: "Monthly", price: 5000, period: "month", popular: false },
              { name: "Yearly", price: 45000, period: "year", popular: true, savings: "25%" }
            ].map((plan, index) => (
              <button
                key={index}
                onClick={() => handleSubscribe(plan.name)}
                className={cn(
                  "w-full p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden",
                  plan.popular 
                    ? "border-primary bg-primary/5" 
                    : "border-border bg-card hover:border-primary/50"
                )}
              >
                {plan.popular && (
                  <Badge className="absolute top-3 right-3 bg-primary">
                    Save {plan.savings}
                  </Badge>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">RWF {formatPrice(plan.price)}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{plan.name} subscription</p>
              </button>
            ))}
          </>
        ) : (
          plans.map((plan, index) => {
            const isPopular = index === 1;
            const isCurrentPlan = subscription?.plan_id === plan.id;

            return (
              <div 
                key={plan.id}
                className={cn(
                  "p-4 rounded-2xl border-2 relative",
                  isPopular ? "border-primary bg-primary/5" : "border-border bg-card"
                )}
              >
                {isPopular && (
                  <Badge className="absolute top-3 right-3 bg-primary">Popular</Badge>
                )}
                <h4 className="font-bold text-lg">{plan.name}</h4>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-2xl font-bold">RWF {formatPrice(plan.price_rwf)}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="mt-3 space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    {plan.post_limit_monthly} products/month
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    {plan.updates_limit_monthly} updates/month
                  </li>
                  {plan.can_edit_product && (
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      Edit products anytime
                    </li>
                  )}
                </ul>
                <Button 
                  className="w-full mt-4"
                  variant={isCurrentPlan ? "outline" : "default"}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isCurrentPlan}
                >
                  {isCurrentPlan ? 'Current Plan' : 'Subscribe'}
                </Button>
              </div>
            );
          })
        )}
      </div>

      {/* CTA for non-subscribers */}
      {!isPremium && (
        <div className="px-4 mt-4">
          <Button className="w-full h-14 rounded-2xl text-lg font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg gap-2">
            <Crown className="h-5 w-5" />
            Upgrade to Premium
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Cancel anytime • 7-day money back guarantee
          </p>
        </div>
      )}
    </div>
  );
};

export default PremiumPage;