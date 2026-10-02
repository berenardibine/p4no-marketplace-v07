const ITEMS = [
  ['Discover with confidence', 'Find products from businesses and sellers in one place.'],
  ['Know your delivery options', 'See available delivery locations and delivery fees before contacting the seller.'],
  ['Connect directly', 'Contact the seller, ask questions, and get the information you need before making a decision.'],
  ['Discover more', 'Explore products, businesses, shops, and services from different locations.'],
  ['Built for everyone', 'P4NO Hub connects people with products, businesses, and services locally and globally.'],
];

export default function WhyP4NOHub() {
  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <h3 className="font-bold text-lg mb-3">🧡 Why use P4NO Hub?</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map(([t, d]) => (
          <div key={t} className="rounded-xl bg-background/70 p-3">
            <p className="font-semibold text-sm text-foreground">{t}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center font-semibold text-primary">Connect. Discover. Grow.</p>
    </section>
  );
}
