import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TermsModalProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

const TermsModal = ({ open, onAccept, onCancel }: TermsModalProps) => {
  const [termsContent, setTermsContent] = useState('');
  const [privacyContent, setPrivacyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPages();
      setAccepted(false);
    }
  }, [open]);

  const fetchPages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('site_pages')
      .select('slug, content')
      .in('slug', ['terms', 'privacy'])
      .eq('is_published', true);

    if (data) {
      const terms = data.find(p => p.slug === 'terms');
      const privacy = data.find(p => p.slug === 'privacy');
      setTermsContent(terms?.content || '<p>Terms & Conditions not available.</p>');
      setPrivacyContent(privacy?.content || '<p>Privacy Policy not available.</p>');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="bg-card max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Terms & Conditions</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[60vh] rounded-lg border p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: termsContent }} />
              <hr className="my-6" />
              <div dangerouslySetInnerHTML={{ __html: privacyContent }} />
            </div>
          </ScrollArea>
        )}

        <div className="flex items-center gap-3 pt-3 border-t">
          <Checkbox
            id="accept-terms"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
          />
          <label htmlFor="accept-terms" className="text-sm cursor-pointer">
            I have read and agree to the <strong>Terms & Conditions</strong> and <strong>Privacy Policy</strong>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onAccept} disabled={!accepted}>
            Accept & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TermsModal;
