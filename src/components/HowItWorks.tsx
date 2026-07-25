import { Search, ShoppingCart, Truck } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: Search,
    title: "Browse & Discover",
    description: "Explore thousands of products from trusted local and global vendors.",
  },
  {
    icon: ShoppingCart,
    title: "Add to Cart",
    description: "Select your favorites, compare prices, and fill your smart cart.",
  },
  {
    icon: Truck,
    title: "Fast Delivery",
    description: "Get your order delivered to your door, fresh and on time.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 px-4">
      <div className="container mx-auto">
        <h2 className="text-3xl md:text-4xl font-display text-foreground text-center mb-4">
          How It Works
        </h2>
        <p className="text-muted-foreground text-center max-w-lg mx-auto mb-14">
          Shopping made simple in three easy steps
        </p>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-5">
                <step.icon className="h-7 w-7 text-primary-foreground" />
              </div>
              <span className="text-xs font-bold text-secondary uppercase tracking-widest mb-2">Step {i + 1}</span>
              <h3 className="text-xl font-display text-foreground mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
