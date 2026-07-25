import { useState, useEffect } from 'react';
import { Star, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const GOOGLE_REVIEW_URL = 'https://g.page/r/CTAhVIOY7iupEBM/review';
const STORAGE_KEY = 'p4no-google-review-dismissed';
const VISIT_COUNT_KEY = 'p4no-page-visit-count';

const GoogleReviewPopup = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed recently (7 days)
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Track page visits, show after 5 visits
    const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0') + 1;
    localStorage.setItem(VISIT_COUNT_KEY, count.toString());

    if (count >= 5) {
      const timer = setTimeout(() => setVisible(true), 8000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  const openReview = () => {
    window.open(GOOGLE_REVIEW_URL, '_blank');
    dismiss();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-24 left-4 right-4 z-[60] md:left-auto md:right-8 md:max-w-sm"
        >
          <div className="bg-card rounded-2xl border shadow-2xl p-5 relative">
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-muted flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center space-y-3">
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className="h-6 w-6 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <h3 className="font-bold text-lg">How satisfied are you with p4no?</h3>
              <p className="text-sm text-muted-foreground">
                Rate us on Google and share your ideas on what we can improve!
              </p>
              <Button
                onClick={openReview}
                className="w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
              >
                <ExternalLink className="h-4 w-4" />
                Rate Us on Google
              </Button>
              <button onClick={dismiss} className="text-xs text-muted-foreground hover:underline">
                Maybe later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GoogleReviewPopup;
