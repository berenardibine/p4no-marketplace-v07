import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-market.jpg";

const Hero = () => {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImage} alt="Fresh market produce" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/30" />
      </div>

      <div className="relative container mx-auto px-4 py-28 md:py-40">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-xl"
        >
          <span className="inline-block bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-6">
            Fresh & Fast Delivery
          </span>
          <h1 className="text-4xl md:text-6xl font-display text-primary-foreground leading-tight mb-6">
            Shop Smarter, Live Better
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-8 leading-relaxed max-w-md">
            Discover thousands of quality products from trusted vendors — delivered fresh to your doorstep.
          </p>
          <div className="flex gap-3">
            <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold px-8">
              Start Shopping
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              Explore Deals
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
