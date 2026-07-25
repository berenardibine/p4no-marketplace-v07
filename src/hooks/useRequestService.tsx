import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import {
  buildServiceRequestMessage,
  serviceShareUrl,
  sanitizePhone,
  openWhatsApp,
  checkServiceCooldown,
  setServiceCooldown,
} from '@/lib/whatsappService';

interface RequestServiceInput {
  service: {
    id: string;
    title: string;
    slug: string | null;
    seller_id: string;
    seller_whatsapp?: string | null;
    seller_name?: string | null;
  };
  message?: string;
  buyerLocation?: string;
}

export function useRequestService() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const requestService = async (input: RequestServiceInput): Promise<boolean> => {
    const phone = sanitizePhone(input.service.seller_whatsapp);
    if (!phone) {
      toast({ title: 'WhatsApp not available', description: 'This provider has not added a WhatsApp number.', variant: 'destructive' });
      return false;
    }

    const cd = checkServiceCooldown(input.service.id);
    if (cd.blocked) {
      const mins = Math.ceil((cd.remainingMs || 0) / 60000);
      toast({ title: 'Please wait', description: `You already requested this service. Try again in ${mins} min.` });
      return false;
    }

    setSubmitting(true);
    try {
      const buyerName = profile?.full_name || 'Guest';
      const buyerPhone = (profile as any)?.phone_number || (profile as any)?.whatsapp_number || '';

      const { data: req, error } = await supabase
        .from('service_requests')
        .insert({
          service_id: input.service.id,
          seller_id: input.service.seller_id,
          buyer_id: user?.id || null,
          buyer_name: buyerName,
          buyer_phone: buyerPhone || null,
          buyer_location: input.buyerLocation || (profile as any)?.location || null,
          message: input.message || null,
          status: 'pending',
        })
        .select('id')
        .maybeSingle();

      if (error) throw error;

      // Notify seller
      await supabase.from('notifications').insert({
        user_id: input.service.seller_id,
        title: 'New service request',
        message: `${buyerName} requested: ${input.service.title}`,
        type: 'info',
        module: 'services',
      });

      const url = serviceShareUrl(input.service.slug || input.service.id);
      const msg = buildServiceRequestMessage({
        serviceTitle: input.service.title,
        serviceUrl: url,
        buyerName,
        buyerLocation: input.buyerLocation || (profile as any)?.location,
        message: input.message,
        requestId: req?.id?.slice(0, 6),
      });

      setServiceCooldown(input.service.id);
      openWhatsApp(phone, msg);
      toast({ title: '✅ Request sent!', description: 'Opening WhatsApp...' });
      return true;
    } catch (err: any) {
      toast({ title: 'Could not send request', description: err.message, variant: 'destructive' });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { requestService, submitting };
}
