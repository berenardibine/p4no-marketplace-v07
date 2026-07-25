import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface IdentityVerification {
  id: string;
  user_id: string;
  method: string;
  id_front_url: string | null;
  id_back_url: string | null;
  face_scan_url: string | null;
  ocr_data: any;
  score: number;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  device_id: string | null;
  ip_address: string | null;
  id_number: string | null;
  created_at: string;
  updated_at: string;
}

export const useIdentityVerification = (userId?: string) => {
  const [verification, setVerification] = useState<IdentityVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchVerification = async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('identity_verifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setVerification(data);
    setLoading(false);
  };

  useEffect(() => { fetchVerification(); }, [userId]);

  const uploadFile = async (file: Blob, path: string) => {
    const { data, error } = await supabase.storage
      .from('verification-files')
      .upload(path, file, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw error;
    return data.path;
  };

  const submitVerification = async (params: {
    method: string;
    frontBlob: Blob;
    backBlob: Blob;
    faceBlob: Blob;
    ocrData: any;
    score: number;
    idNumber?: string;
  }) => {
    if (!userId) throw new Error("Not authenticated");

    const ts = Date.now();
    const frontPath = `${userId}/front_${ts}.jpg`;
    const backPath = `${userId}/back_${ts}.jpg`;
    const facePath = `${userId}/face_${ts}.jpg`;

    await Promise.all([
      uploadFile(params.frontBlob, frontPath),
      uploadFile(params.backBlob, backPath),
      uploadFile(params.faceBlob, facePath),
    ]);

    const status = params.score >= 0.8 ? 'pending_review' : 'retry_required';

    const { data, error } = await (supabase as any)
      .from('identity_verifications')
      .insert({
        user_id: userId,
        method: params.method,
        id_front_url: frontPath,
        id_back_url: backPath,
        face_scan_url: facePath,
        ocr_data: params.ocrData,
        score: params.score,
        status,
        id_number: params.idNumber || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification to admin
    await (supabase as any).from('notifications').insert({
      title: '🆕 New Verification Request',
      message: `New identity verification submitted.`,
      type: 'admin',
      user_id: null,
    });

    setVerification(data);
    return data;
  };

  return { verification, loading, refresh: fetchVerification, submitVerification };
};

// Admin hook
export const useAdminVerifications = () => {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    // Fetch verifications
    const { data: verifs } = await (supabase as any)
      .from('identity_verifications')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Fetch profiles for each verification to get user info
    const enriched = await Promise.all((verifs || []).map(async (v: any) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, profile_image')
        .eq('id', v.user_id)
        .single();
      return { ...v, profiles: profile };
    }));
    
    setVerifications(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from('verification-files')
      .createSignedUrl(path, 600); // 10 min
    return data?.signedUrl || '';
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected', notes: string, userId: string) => {
    const { error } = await (supabase as any)
      .from('identity_verifications')
      .update({ status, admin_notes: notes, reviewed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({ title: "Failed to update verification", variant: "destructive" });
      return;
    }

    // If approved, update profile identity_verified
    if (status === 'approved') {
      await supabase
        .from('profiles')
        .update({ identity_verified: true } as any)
        .eq('id', userId);
    }

    // Notify user
    const message = status === 'approved'
      ? '✅ Your identity has been verified. You are now a verified seller on p4no.'
      : `❌ Verification Rejected. Reason: ${notes}. Please retry.`;

    await (supabase as any).from('notifications').insert({
      title: status === 'approved' ? 'Verification Approved' : 'Verification Rejected',
      message,
      type: 'verification',
      user_id: userId,
    });

    toast({ title: `Verification ${status}` });
    fetchAll();
  };

  // Check duplicate IDs
  const checkDuplicate = async (idNumber: string, excludeUserId: string) => {
    const { data } = await (supabase as any)
      .from('identity_verifications')
      .select('id, user_id, profiles:user_id(full_name)')
      .eq('id_number', idNumber)
      .neq('user_id', excludeUserId);
    return data || [];
  };

  return { verifications, loading, refresh: fetchAll, updateStatus, getSignedUrl, checkDuplicate };
};
