import { useState } from 'react';
import { Loader2, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestService } from '@/hooks/useRequestService';
import { cn } from '@/lib/utils';

interface Props {
  service: {
    id: string;
    title: string;
    slug: string | null;
    seller_id: string;
    seller_whatsapp?: string | null;
    seller_name?: string | null;
  };
  className?: string;
  variant?: 'default' | 'compact' | 'icon';
  children?: React.ReactNode;
}

const RequestServiceButton = ({ service, className, variant = 'default', children }: Props) => {
  const { requestService, submitting } = useRequestService();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    const ok = await requestService({ service, message, buyerLocation: location });
    if (ok) {
      setSuccess(true);
      setTimeout(() => { setOpen(false); setSuccess(false); setMessage(''); setLocation(''); }, 1200);
    }
  };

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={cn('flex flex-col items-center gap-1 active:scale-95 transition-transform', className)}
        >
          <span className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
            {success ? <Check className="h-5 w-5" /> : <Send className="h-5 w-5" />}
          </span>
          <span className="text-[10px] text-white drop-shadow font-medium">Request</span>
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Request: {service.title}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Your location (optional)</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Kigali, Nyarugenge" />
              </div>
              <div>
                <Label>Message (optional)</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell the provider what you need..." rows={4} />
              </div>
              <Button onClick={submit} disabled={submitting} className="w-full gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {success ? 'Sent!' : 'Send request via WhatsApp'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={cn('gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80', className)}
        size={variant === 'compact' ? 'sm' : 'default'}
      >
        {success ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        {children || 'Request Service'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request: {service.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Your location (optional)</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Kigali, Nyarugenge" />
            </div>
            <div>
              <Label>Message (optional)</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell the provider what you need..." rows={4} />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {success ? 'Sent!' : 'Send request via WhatsApp'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RequestServiceButton;
