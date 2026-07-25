import { motion } from "framer-motion";
import { Apple, Beef, Milk, Wheat, Coffee, Salad } from "lucide-react";

const categories = [
  { name: "Fruits", icon: Apple, color: "bg-red-50 text-red-500" },
  { name: "Meat", icon: Beef, color: "bg-orange-50 text-orange-600" },
  { name: "Dairy", icon: Milk, color: "bg-blue-50 text-blue-500" },
  { name: "Bakery", icon: Wheat, color: "bg-amber-50 text-amber-600" },
  { name: "Beverages", icon: Coffee, color: "bg-emerald-50 text-emerald-600" },
  { name: "Vegetables", icon: Salad, color: "bg-green-50 text-green-600" },
];

const Categories = () => {
  return (
    <section id="categories" className="py-20 px-4 bg-muted/50">
      <div className="container mx-auto">
        <h2 className="text-3xl md:text-4xl font-display text-foreground text-center mb-4">
          Shop by Category
        </h2>
        <p className="text-muted-foreground text-center max-w-md mx-auto mb-12">
          Find exactly what you need, organized for your convenience
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 max-w-4xl mx-auto">
          {categories.map((cat, i) => (
            <motion.a
              href="#"
              key={cat.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              whileHover={{ y: -4 }}
              className="flex flex-col items-center gap-3 bg-card rounded-xl p-6 shadow-card hover:shadow-elevated transition-shadow cursor-pointer"
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${cat.color}`}>
                <cat.icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-semibold text-foreground">{cat.name}</span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Categories;
