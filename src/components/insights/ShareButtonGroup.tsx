import { useState } from 'react';
import { Share2, Copy, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  url?: string;
  variant?: 'sticky' | 'inline';
  className?: string;
}

const WhatsAppIcon = () => (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.555-5.338 11.892-11.892 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26L2.5 21.5l3.65-1.307zM17.5 14.382c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.173.198-.297.297-.495.099-.198.05-.371-.025-.52-.074-.149-.669-1.611-.916-2.207-.242-.579-.487-.501-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.371-.272.297-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z"/></svg>);
const FacebookIcon = () => (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>);
const XIcon = () => (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>);
const LinkedInIcon = () => (<svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>);

const ShareButtonGroup = ({ title, url, variant = 'inline', className }: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const encoded = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const targets = [
    { name: 'WhatsApp', icon: WhatsAppIcon, color: 'bg-[#25D366] hover:bg-[#1ebe5b]', href: `https://wa.me/?text=${encodedTitle}%20${encoded}` },
    { name: 'Facebook', icon: FacebookIcon, color: 'bg-[#1877F2] hover:bg-[#0e63d4]', href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}` },
    { name: 'X', icon: XIcon, color: 'bg-black hover:bg-neutral-800', href: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodedTitle}` },
    { name: 'LinkedIn', icon: LinkedInIcon, color: 'bg-[#0A66C2] hover:bg-[#0855a3]', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}` },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: 'Link copied' });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  const openShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share && window.innerWidth < 640) {
      try {
        await (navigator as any).share({ title, url: shareUrl });
        return;
      } catch { /* fall back to menu */ }
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openShare}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-95 shadow-md',
          variant === 'sticky'
            ? 'h-12 w-12 sm:h-auto sm:w-auto sm:px-5 sm:py-3 rounded-full bg-primary text-primary-foreground hover:shadow-lg'
            : 'h-11 px-5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90',
          className,
        )}
        aria-label="Share article"
      >
        <Share2 className="h-5 w-5" />
        <span className={variant === 'sticky' ? 'hidden sm:inline' : ''}>Share</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center animate-fade-in" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl bg-card border border-border p-5 pb-8 sm:pb-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Share this article</h3>
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {targets.map((t) => (
                <a
                  key={t.name} href={t.href} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <span className={cn('h-12 w-12 rounded-full text-white flex items-center justify-center transition-transform group-hover:scale-110 group-active:scale-95', t.color)}>
                    <t.icon />
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">{t.name}</span>
                </a>
              ))}
            </div>
            <button
              type="button"
              onClick={copy}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 hover:bg-muted px-4 py-3 transition-colors"
            >
              <span className="text-sm truncate text-muted-foreground">{shareUrl}</span>
              <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ShareButtonGroup;