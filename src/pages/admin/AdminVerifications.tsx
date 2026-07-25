import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, Shield, Check, X, Eye,
  AlertTriangle, Search, User, FileText, ToggleLeft, ToggleRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { useAdmin } from "@/hooks/useAdmin";
import { useAdminVerifications } from "@/hooks/useIdentityVerification";
import { useAdminSettings } from "@/hooks/useAdminSettings";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const AdminVerifications = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { verifications, loading, refresh, updateStatus, getSignedUrl, checkDuplicate } = useAdminVerifications();
  const { getSetting, updateSetting, loading: settingsLoading } = useAdminSettings();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [viewItem, setViewItem] = useState<any>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);

  const requireVerification = getSetting('require_identity_verification', true);

  const filtered = verifications.filter(v => {
    const name = v.profiles?.full_name || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || v.status === filter;
    return matchesSearch && matchesFilter;
  });

  const openView = async (item: any) => {
    setViewItem(item);
    const urls: Record<string, string> = {};
    if (item.id_front_url) urls.front = await getSignedUrl(item.id_front_url);
    if (item.id_back_url) urls.back = await getSignedUrl(item.id_back_url);
    if (item.face_scan_url) urls.face = await getSignedUrl(item.face_scan_url);
    setSignedUrls(urls);
    if (item.id_number) {
      const dupes = await checkDuplicate(item.id_number, item.user_id);
      setDuplicates(dupes);
    } else {
      setDuplicates([]);
    }
  };

  const handleAction = async () => {
    if (!viewItem || !actionType) return;
    if (actionType === 'reject' && !notes.trim()) {
      toast({ title: "Please provide a reason for rejection", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    await updateStatus(viewItem.id, actionType === 'approve' ? 'approved' : 'rejected', notes.trim(), viewItem.user_id);
    setActionLoading(false);
    setViewItem(null);
    setActionType(null);
    setNotes("");
  };

  const handleToggleVerification = async () => {
    const newValue = !requireVerification;
    await updateSetting('require_identity_verification', newValue);
    toast({ 
      title: newValue ? 'Verification Required' : 'Verification Optional',
      description: newValue 
        ? 'Sellers must verify identity before posting products.' 
        : 'All sellers can post products without verification.'
    });
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      retry_required: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    };
    return <Badge className={cn("text-xs capitalize", styles[status] || '')}>{status.replace('_', ' ')}</Badge>;
  };

  if (adminLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAdmin) { navigate('/'); return null; }

  const pending = verifications.filter(v => v.status === 'pending_review').length;
  const approved = verifications.filter(v => v.status === 'approved').length;
  const rejected = verifications.filter(v => v.status === 'rejected').length;
  const avgScore = verifications.length ? Math.round(verifications.reduce((s, v) => s + (v.score || 0), 0) / verifications.length * 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/admin')} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Identity Verifications</h1>
            <p className="text-xs text-muted-foreground">{verifications.length} total</p>
          </div>
          <Button variant="outline" size="icon" className="rounded-xl" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Verification Toggle */}
        <div className="bg-card rounded-2xl p-4 border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                requireVerification ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
              )}>
                <Shield className={cn("h-5 w-5", requireVerification ? "text-green-600" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="font-medium text-sm">Require Identity Verification</p>
                <p className="text-xs text-muted-foreground">
                  {requireVerification 
                    ? 'Sellers must verify identity to post products' 
                    : 'All sellers can post without verification'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleVerification}
              disabled={settingsLoading}
              className="transition-colors"
            >
              {requireVerification ? (
                <ToggleRight className="h-8 w-8 text-green-600" />
              ) : (
                <ToggleLeft className="h-8 w-8 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-card rounded-xl p-3 border text-center">
            <p className="text-lg font-bold text-amber-600">{pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="bg-card rounded-xl p-3 border text-center">
            <p className="text-lg font-bold text-green-600">{approved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
          <div className="bg-card rounded-xl p-3 border text-center">
            <p className="text-lg font-bold text-red-600">{rejected}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </div>
          <div className="bg-card rounded-xl p-3 border text-center">
            <p className="text-lg font-bold">{avgScore}%</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-12 rounded-xl bg-card" />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['all', 'pending_review', 'approved', 'rejected'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all capitalize",
              filter === f ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border hover:bg-muted"
            )}>
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {loading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No verifications found</div>
          ) : (
            filtered.map(v => (
              <div key={v.id} className="bg-card rounded-xl p-3 border flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {v.profiles?.full_name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{v.profiles?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{v.method?.replace('_', ' ')} · Score: {Math.round((v.score || 0) * 100)}%</p>
                  <div className="flex items-center gap-2 mt-1">
                    {statusBadge(v.status)}
                    <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => openView(v)}>
                  <Eye className="h-3 w-3" /> View
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* View/Review Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => { setViewItem(null); setActionType(null); setNotes(""); }}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Verification Details
            </DialogTitle>
          </DialogHeader>

          {viewItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {viewItem.profiles?.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-medium text-sm">{viewItem.profiles?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{viewItem.profiles?.email}</p>
                </div>
                {statusBadge(viewItem.status)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-xl p-3 border">
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p className="font-medium text-sm capitalize">{viewItem.method?.replace('_', ' ')}</p>
                </div>
                <div className="bg-card rounded-xl p-3 border">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className={cn("font-bold text-lg", (viewItem.score || 0) >= 0.8 ? "text-green-600" : "text-orange-600")}>
                    {Math.round((viewItem.score || 0) * 100)}%
                  </p>
                </div>
              </div>

              {viewItem.ocr_data && Object.keys(viewItem.ocr_data).length > 0 && (
                <div className="bg-card rounded-xl p-3 border">
                  <p className="text-xs text-muted-foreground mb-2">Extracted Data</p>
                  <pre className="text-xs bg-muted p-2 rounded-lg overflow-x-auto">{JSON.stringify(viewItem.ocr_data, null, 2)}</pre>
                </div>
              )}

              {duplicates.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 text-red-600 mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium text-sm">⚠️ Duplicate ID Detected!</span>
                  </div>
                  <p className="text-xs text-red-600/80">This ID number was submitted by {duplicates.length} other user(s):</p>
                  {duplicates.map(d => (
                    <p key={d.id} className="text-xs font-medium text-red-700 mt-1">{d.profiles?.full_name || d.user_id}</p>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Documents</p>
                <div className="grid grid-cols-3 gap-2">
                  {signedUrls.front && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Front</p>
                      <img src={signedUrls.front} alt="Front" className="rounded-xl border aspect-[4/3] object-cover w-full cursor-pointer" onClick={() => window.open(signedUrls.front, '_blank')} />
                    </div>
                  )}
                  {signedUrls.back && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Back</p>
                      <img src={signedUrls.back} alt="Back" className="rounded-xl border aspect-[4/3] object-cover w-full cursor-pointer" onClick={() => window.open(signedUrls.back, '_blank')} />
                    </div>
                  )}
                  {signedUrls.face && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Face</p>
                      <img src={signedUrls.face} alt="Face" className="rounded-xl border aspect-square object-cover w-full cursor-pointer" onClick={() => window.open(signedUrls.face, '_blank')} />
                    </div>
                  )}
                </div>
              </div>

              {viewItem.admin_notes && (
                <div className="bg-muted rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Admin Notes</p>
                  <p className="text-sm">{viewItem.admin_notes}</p>
                </div>
              )}

              {viewItem.status === 'pending_review' && (
                <div className="space-y-3">
                  {actionType && (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        {actionType === 'reject' ? 'Reason for rejection *' : 'Notes (optional)'}
                      </label>
                      <Textarea
                        placeholder={actionType === 'reject' ? 'Why is this being rejected?' : 'Optional admin notes...'}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="rounded-xl"
                        rows={3}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    {!actionType ? (
                      <>
                        <Button onClick={() => setActionType('approve')} className="flex-1 rounded-xl gap-1 bg-green-600 hover:bg-green-700">
                          <Check className="h-4 w-4" /> Approve
                        </Button>
                        <Button onClick={() => setActionType('reject')} variant="destructive" className="flex-1 rounded-xl gap-1">
                          <X className="h-4 w-4" /> Reject
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setActionType(null)} className="flex-1 rounded-xl">Cancel</Button>
                        <Button
                          onClick={handleAction}
                          disabled={actionLoading || (actionType === 'reject' && !notes.trim())}
                          className={cn("flex-1 rounded-xl", actionType === 'approve' ? "bg-green-600 hover:bg-green-700" : "")}
                          variant={actionType === 'reject' ? 'destructive' : 'default'}
                        >
                          {actionLoading ? "Processing..." : actionType === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVerifications;
