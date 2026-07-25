import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const AdminWithdrawals = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [pay, setPay] = useState<any | null>(null);
  const [ref, setRef] = useState(""); const [note, setNote] = useState("");
  const [reject, setReject] = useState<any | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    const { data } = await supabase.from("withdrawals").select("*").eq("status", status).order("created_at", { ascending: false }).limit(200);
    const ids = [...new Set((data || []).map((r: any) => r.user_id))];
    const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email, country_code").in("id", ids) : { data: [] };
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    setRows((data || []).map((r: any) => ({ ...r, user: map.get(r.user_id) })));
  };
  useEffect(() => { load(); }, [status]);

  const approve = async (id: string) => {
    const { error } = await supabase.rpc("withdrawal_approve", { _id: id } as any);
    if (error) toast.error(error.message); else { toast.success("Approved"); load(); }
  };
  const markPaid = async () => {
    const { error } = await supabase.rpc("withdrawal_mark_paid", { _id: pay.id, _reference: ref || null, _note: note || null } as any);
    if (error) toast.error(error.message); else { toast.success("Marked paid"); setPay(null); setRef(""); setNote(""); load(); }
  };
  const doReject = async () => {
    const { error } = await supabase.rpc("withdrawal_reject", { _id: reject.id, _reason: reason } as any);
    if (error) toast.error(error.message); else { toast.success("Rejected"); setReject(null); setReason(""); load(); }
  };

  const exportCsv = () => {
    const header = "id,user,method,points,usd,status,created_at,paid_at\n";
    const body = rows.map(r => [r.id, r.user?.email || r.user_id, r.method, r.points, r.usd_amount, r.status, r.created_at, r.paid_at || ""].join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `withdrawals-${status}.csv`; a.click();
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-lg font-semibold flex-1">Withdrawals</h1>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" />CSV</Button>
        </div>
      </div>
      <div className="max-w-5xl mx-auto p-4 space-y-3">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nothing here</p>}
        {rows.map(r => (
          <Card key={r.id} className="p-3">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium">{r.user?.full_name || r.user?.email || r.user_id}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.country}</div>
                <div className="mt-1"><Badge variant="outline" className="capitalize">{r.method}</Badge> <span className="font-bold">{r.points} pts</span> <span className="text-muted-foreground">${Number(r.usd_amount).toFixed(2)}</span></div>
                <pre className="text-xs bg-muted rounded p-2 mt-2 overflow-x-auto">{JSON.stringify(r.payload, null, 2)}</pre>
                {r.rejection_reason && <div className="text-xs text-red-500 mt-1">{r.rejection_reason}</div>}
                {r.paid_reference && <div className="text-xs mt-1">Ref: {r.paid_reference}</div>}
              </div>
              <div className="flex flex-col gap-2">
                {r.status === "pending" && <Button size="sm" onClick={() => approve(r.id)}>Approve</Button>}
                {(r.status === "pending" || r.status === "approved") && <>
                  <Button size="sm" variant="default" onClick={() => setPay(r)}>Mark paid</Button>
                  <Button size="sm" variant="outline" onClick={() => setReject(r)}>Reject</Button>
                </>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!pay} onOpenChange={o => !o && setPay(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark as paid</DialogTitle></DialogHeader>
          <Input placeholder="Payment reference (optional)" value={ref} onChange={e => setRef(e.target.value)} />
          <Textarea placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
          <Button onClick={markPaid}>Confirm paid</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!reject} onOpenChange={o => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject withdrawal</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} />
          <Button variant="destructive" onClick={doReject}>Reject</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWithdrawals;
