import { useState } from 'react';
import { Copy, Check, Share2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useReferral } from '@/hooks/useReferral';

const ShareReferral = () => {
  const { referralCode, getShareUrl, trackShare } = useReferral();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!referralCode) return null;

  const shareUrl = getShareUrl();
  const shareText = `Join p4no and support me! Use code ${referralCode} for benefits. ${shareUrl}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    trackShare('copy');
    toast({ title: 'Link copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    trackShare('whatsapp');
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareTelegram = () => {
    trackShare('telegram');
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Join p4no! Use code ${referralCode}`)}`, '_blank');
  };

  const shareFacebook = () => {
    trackShare('facebook');
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const shareTwitter = () => {
    trackShare('twitter');
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Referral Code Display */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/20 text-center">
        <p className="text-xs text-muted-foreground mb-1">Your Referral Code</p>
        <p className="text-2xl font-mono font-bold text-primary tracking-wider">{referralCode}</p>
      </div>

      {/* Copy Link */}
      <div className="flex gap-2">
        <div className="flex-1 bg-muted/50 rounded-xl px-3 py-2 text-sm text-muted-foreground truncate border">
          {shareUrl}
        </div>
        <Button onClick={copyLink} size="sm" className="rounded-xl gap-1.5 shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {/* Share Buttons */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={shareWhatsApp}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors border border-green-200/50"
        >
          <MessageCircle className="h-5 w-5 text-green-600" />
          <span className="text-[10px] font-medium text-green-700 dark:text-green-400">WhatsApp</span>
        </button>
        <button
          onClick={shareTelegram}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors border border-blue-200/50"
        >
          <Share2 className="h-5 w-5 text-blue-600" />
          <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400">Telegram</span>
        </button>
        <button
          onClick={shareFacebook}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors border border-indigo-200/50"
        >
          <Share2 className="h-5 w-5 text-indigo-600" />
          <span className="text-[10px] font-medium text-indigo-700 dark:text-indigo-400">Facebook</span>
        </button>
        <button
          onClick={shareTwitter}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-950/50 transition-colors border border-sky-200/50"
        >
          <Share2 className="h-5 w-5 text-sky-600" />
          <span className="text-[10px] font-medium text-sky-700 dark:text-sky-400">Twitter</span>
        </button>
      </div>
    </div>
  );
};

export default ShareReferral;
