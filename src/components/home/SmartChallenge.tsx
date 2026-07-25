import { Trophy, ArrowRight, Flame, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const SmartChallenge = () => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 p-5 shadow-lg">
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 blur-2xl animate-pulse-slow" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/10" />
      
      {/* Trophy icon */}
      <div className="absolute top-3 right-3 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center animate-float">
        <Trophy className="h-7 w-7 text-white" />
      </div>
      
      <div className="relative pr-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-semibold mb-3">
          <Flame className="h-3.5 w-3.5 animate-pulse" />
          Active Challenge
        </div>
        
        <h3 className="text-white font-bold text-lg mb-1.5 flex items-center gap-2">
          Listing Challenge
          <Zap className="h-5 w-5 text-yellow-300" />
        </h3>
        
        <p className="text-white/90 text-sm mb-4 leading-relaxed">
          List 5 products today and get extra visibility for your shop!
        </p>
        
        <Button 
          variant="secondary" 
          size="sm" 
          className="bg-white text-green-600 hover:bg-white/90 gap-1.5 font-semibold shadow-soft"
        >
          Join Challenge
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default SmartChallenge;
