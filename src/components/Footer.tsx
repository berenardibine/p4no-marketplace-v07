const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground py-16 px-4">
      <div className="container mx-auto grid md:grid-cols-4 gap-10">
        <div>
          <h3 className="text-2xl font-display mb-3">p4no</h3>
          <p className="text-primary-foreground/70 text-sm leading-relaxed">
            Your intelligent marketplace for fresh produce, daily essentials, and more.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Shop</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li><a href="#" className="hover:text-primary-foreground transition-colors">Categories</a></li>
            <li><a href="#" className="hover:text-primary-foreground transition-colors">Deals</a></li>
            <li><a href="#" className="hover:text-primary-foreground transition-colors">New Arrivals</a></li>
            <li><a href="#" className="hover:text-primary-foreground transition-colors">Best Sellers</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Support</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li><a href="#" className="hover:text-primary-foreground transition-colors">Help Center</a></li>
            <li><a href="#" className="hover:text-primary-foreground transition-colors">Shipping Info</a></li>
            <li><a href="#" className="hover:text-primary-foreground transition-colors">Returns</a></li>
            <li><a href="#" className="hover:text-primary-foreground transition-colors">Contact Us</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Company</h4>
          <ul className="space-y-2 text-sm text-primary-foreground/70">
            <li><a href="#" className="hover:text-primary-foreground transition-colors">About</a></li>
            <li><a href="#" className="hover:text-primary-foreground transition-colors">Careers</a></li>
            <li><a href="#" className="hover:text-primary-foreground transition-colors">Privacy</a></li>
            <li><a href="#" className="hover:text-primary-foreground transition-colors">Terms</a></li>
          </ul>
        </div>
      </div>
      <div className="container mx-auto mt-12 pt-6 border-t border-primary-foreground/20 text-center text-xs text-primary-foreground/50">
        © 2026 p4no. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
