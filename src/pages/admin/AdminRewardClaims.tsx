import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

const REJECT_REASONS = [
  "Identity Verification Missing",
  "Insufficient Growth Score",
  "No Approved Product",
  "Duplicate Account",
  "Self Referral",
  "Fraud Detected",
  "Suspicious Device",
  "Terms Violation",
];

const AdminRewardClaims = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reject, setReject] = useState<{ id: string } | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [custom, setCustom] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("reward_claims").select("*")
      .eq("status", status).order("created_at", { ascending: false }).limit(200);
    const ids = [...new Set((data || []).flatMap((r: any) => [r.user_id, r.source_user_id]).filter(Boolean))];
    const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setRows((data || []).map((r: any) => ({ ...r, earner: map.get(r.user_id), source: map.get(r.source_user_id) })));
    setLoading(false);
  };
  useEffect(() => { load(); }, [status]);

  const approve = async (id: string) => {
    const { error } = await supabase.rpc("reward_claim_approve", { _claim_id: id } as any);
    if (error) toast.error(error.message); else { toast.success("Approved"); load(); }
  };
  const doReject = async () => {
    if (!reject) return;
    const finalReason = reason === "Custom" ? custom : reason;
    const { error } = await supabase.rpc("reward_claim_reject", { _claim_id: reject.id, _reason: finalReason } as any);
    if (error) toast.error(error.message); else { toast.success("Rejected"); setReject(null); load(); }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-lg font-semibold">Reward Claims</h1>
        </div>
      </div>
      <div className="max-w-5xl mx-auto p-4 space-y-3">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="auto_approved">Auto-approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        {loading && <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nothing here</p>}
        {rows.map(r => (
          <Card key={r.id} className="p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium capitalize">{r.kind.replace(/_/g, " ")}</span>
                  <Badge>{r.points} pts</Badge>
                  <Badge variant={r.fraud_level === "high" ? "destructive" : r.fraud_level === "medium" ? "secondary" : "outline"}>
                    fraud: {r.fraud_level} ({r.fraud_score})
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  To: {r.earner?.full_name || r.earner?.email || r.user_id}
                  {r.source && <> · Source: {r.source.full_name || r.source.email}</>}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                {r.rejection_reason && <div className="text-xs text-red-500 mt-1">{r.rejection_reason}</div>}
              </div>
              {status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approve(r.id)}><CheckCircle2 className="w-4 h-4 mr-1" />Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => { setReject({ id: r.id }); setReason(REJECT_REASONS[0]); setCustom(""); }}>
                    <XCircle className="w-4 h-4 mr-1" />Reject
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!reject} onOpenChange={o => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject claim</DialogTitle></DialogHeader>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REJECT_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              <SelectItem value="Custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {reason === "Custom" && <Textarea value={custom} onChange={e => setCustom(e.target.value)} placeholder="Reason…" />}
          <Button onClick={doReject} variant="destructive">Reject claim</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRewardClaims;
