import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type ReportTarget = 'product' | 'service' | 'reel' | 'comment' | 'user' | 'shop';
export type ReportReason = 'scam' | 'spam' | 'inappropriate' | 'fake_provider' | 'abusive' | 'other';

export const useContentReports = () => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const report = async (
    targetType: ReportTarget,
    targetId: string,
    reason: ReportReason,
    details?: string
  ) => {
    if (!user) return { error: new Error('not authenticated') };
    setSubmitting(true);
    const { error } = await supabase.from('content_reports').insert({
      target_type: targetType,
      target_id: targetId,
      reporter_id: user.id,
      reason,
      details: details || null,
    });
    setSubmitting(false);
    return { error };
  };

  return { report, submitting };
};
