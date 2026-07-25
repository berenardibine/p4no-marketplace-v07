import { motion } from "framer-motion";
import { Star, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

const products = [
  { name: "Organic Avocados", price: 4.99, originalPrice: 6.99, rating: 4.8, reviews: 124, badge: "Popular", image: "🥑" },
  { name: "Fresh Salmon Fillet", price: 12.99, originalPrice: null, rating: 4.9, reviews: 89, badge: "Premium", image: "🐟" },
  { name: "Artisan Sourdough", price: 6.50, originalPrice: 8.00, rating: 4.7, reviews: 203, badge: "New", image: "🍞" },
  { name: "Greek Olive Oil", price: 9.99, originalPrice: 13.99, rating: 4.9, reviews: 156, badge: "Best Seller", image: "🫒" },
  { name: "Wild Blueberries", price: 5.49, originalPrice: null, rating: 4.6, reviews: 92, badge: null, image: "🫐" },
  { name: "Aged Parmesan", price: 8.99, originalPrice: 11.99, rating: 4.8, reviews: 178, badge: "Popular", image: "🧀" },
  { name: "Matcha Powder", price: 14.99, originalPrice: null, rating: 4.7, reviews: 67, badge: "Trending", image: "🍵" },
  { name: "Organic Honey", price: 7.99, originalPrice: 10.49, rating: 4.9, reviews: 241, badge: "Best Seller", image: "🍯" },
];

const FeaturedProducts = () => {
  return (
    <section id="deals" className="py-20 px-4">
      <div className="container mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-display text-foreground mb-2">
              Featured Products
            </h2>
            <p className="text-muted-foreground">Handpicked favorites from our marketplace</p>
          </div>
          <Button variant="outline" className="hidden md:flex">View All Products</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {products.map((product, i) => (
            <motion.div
              key={product.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className="group bg-card rounded-xl p-4 shadow-card hover:shadow-elevated transition-all cursor-pointer"
            >
              <div className="relative bg-muted rounded-lg h-32 md:h-40 flex items-center justify-center text-5xl md:text-6xl mb-4">
                {product.image}
                {product.badge && (
                  <span className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                    {product.badge}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-sm text-foreground mb-1 truncate">{product.name}</h3>
              <div className="flex items-center gap-1 mb-2">
                <Star className="h-3 w-3 fill-secondary text-secondary" />
                <span className="text-xs text-muted-foreground">{product.rating} ({product.reviews})</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-foreground">${product.price.toFixed(2)}</span>
                  {product.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through">${product.originalPrice.toFixed(2)}</span>
                  )}
                  {product.originalPrice && (
                    <span className="text-[10px] font-bold text-destructive">
                      -{Math.round((1 - product.price / product.originalPrice) * 100)}%
                    </span>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                  <ShoppingCart className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Button variant="outline">View All Products</Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
