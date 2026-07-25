import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, FileText, History, Mail, Plus, Eye, Trash2, Edit2, Users, Store, UserCheck, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const AdminEmailCenter = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [activeTab, setActiveTab] = useState("compose");

  // Compose state
  const [recipientType, setRecipientType] = useState("all");
  const [customEmails, setCustomEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateForm, setTemplateForm] = useState({ title: "", subject: "", html_content: "" });
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templatePreview, setTemplatePreview] = useState<any>(null);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [historyDetail, setHistoryDetail] = useState<any>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchTemplates();
      fetchHistory();
    }
  }, [isAdmin]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("email_templates" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTemplates(data as any[]);
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("sent_emails" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setHistory(data as any[]);
  };

  const getRecipients = async (): Promise<string[]> => {
    if (recipientType === "custom") {
      return customEmails.split(",").map((e) => e.trim()).filter(Boolean);
    }

    let query = supabase.from("profiles").select("email");
    if (recipientType === "sellers") {
      query = query.eq("user_type", "seller");
    } else if (recipientType === "buyers") {
      query = query.eq("user_type", "buyer");
    }
    const { data } = await query;
    return data?.map((p: any) => p.email).filter(Boolean) || [];
  };

  const handleSend = async () => {
    if (!subject || !htmlBody) {
      toast({ title: "Missing fields", description: "Subject and body are required.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const recipients = await getRecipients();
      if (recipients.length === 0) {
        toast({ title: "No recipients", description: "No email addresses found.", variant: "destructive" });
        setSending(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: recipients, subject, html: htmlBody },
      });

      if (error) throw error;

      toast({
        title: "Emails sent!",
        description: `Successfully sent to ${data.sent} of ${data.total} recipients.`,
      });

      setSubject("");
      setHtmlBody("");
      setCustomEmails("");
      fetchHistory();
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleTestSend = async () => {
    if (!subject || !htmlBody) {
      toast({ title: "Missing fields", description: "Subject and body are required.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("No email found");

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: [email], subject: `[TEST] ${subject}`, html: htmlBody },
      });
      if (error) throw error;
      toast({ title: "Test email sent!", description: `Sent to ${email}` });
    } catch (err: any) {
      toast({ title: "Test send failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((t) => t.id === id);
    if (t) {
      setSubject(t.subject);
      setHtmlBody(t.html_content);
      setSelectedTemplate(id);
    }
  };

  const saveTemplate = async () => {
    if (!templateForm.title || !templateForm.subject || !templateForm.html_content) {
      toast({ title: "All fields required", variant: "destructive" });
      return;
    }

    if (editingTemplate) {
      await supabase
        .from("email_templates" as any)
        .update({ title: templateForm.title, subject: templateForm.subject, html_content: templateForm.html_content } as any)
        .eq("id", editingTemplate);
    } else {
      await supabase
        .from("email_templates" as any)
        .insert(templateForm as any);
    }

    setTemplateDialogOpen(false);
    setEditingTemplate(null);
    setTemplateForm({ title: "", subject: "", html_content: "" });
    fetchTemplates();
    toast({ title: editingTemplate ? "Template updated" : "Template created" });
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("email_templates" as any).delete().eq("id", id);
    fetchTemplates();
    toast({ title: "Template deleted" });
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate("/");
    return null;
  }

  const wrappedPreview = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <div style="background:#f97316;color:#fff;padding:20px 24px;text-align:center;">
        <h2 style="margin:0;font-size:22px;">p4no</h2>
      </div>
      <div style="padding:24px;color:#333;">${htmlBody}</div>
      <div style="background:#fafafa;padding:16px;text-align:center;color:#888;font-size:12px;border-top:1px solid #eee;">
        © 2026 p4no | support@smartmarket.com
      </div>
    </div>`;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 h-14 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Mail className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-lg">Email Center</h1>
        </div>
      </div>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full mb-4">
            <TabsTrigger value="compose" className="gap-1">
              <Send className="h-4 w-4" /> Compose
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1">
              <FileText className="h-4 w-4" /> Templates
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="h-4 w-4" /> History
            </TabsTrigger>
          </TabsList>

          {/* COMPOSE TAB */}
          <TabsContent value="compose" className="space-y-4">
            <div className="bg-card rounded-2xl border p-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Recipients</label>
                <Select value={recipientType} onValueChange={setRecipientType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><span className="flex items-center gap-2"><Users className="h-4 w-4" /> All Users</span></SelectItem>
                    <SelectItem value="sellers"><span className="flex items-center gap-2"><Store className="h-4 w-4" /> Sellers Only</span></SelectItem>
                    <SelectItem value="buyers"><span className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> Buyers Only</span></SelectItem>
                    <SelectItem value="custom"><span className="flex items-center gap-2"><Edit2 className="h-4 w-4" /> Custom List</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recipientType === "custom" && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email Addresses (comma separated)</label>
                  <Textarea
                    placeholder="user1@example.com, user2@example.com"
                    value={customEmails}
                    onChange={(e) => setCustomEmails(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              )}

              {templates.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Apply Template</label>
                  <Select value={selectedTemplate} onValueChange={applyTemplate}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1.5 block">Subject</label>
                <Input
                  placeholder="Email subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Body (HTML)</label>
                <Textarea
                  placeholder="<h2>Hello!</h2><p>Your message here...</p>"
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  className="rounded-xl min-h-[200px] font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setPreviewOpen(true)} variant="outline" className="rounded-xl gap-2 flex-1">
                  <Eye className="h-4 w-4" /> Preview
                </Button>
                <Button onClick={handleTestSend} variant="outline" className="rounded-xl gap-2 flex-1" disabled={sending}>
                  <Mail className="h-4 w-4" /> Test Send
                </Button>
                <Button onClick={handleSend} className="rounded-xl gap-2 flex-1 bg-primary" disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* TEMPLATES TAB */}
          <TabsContent value="templates" className="space-y-4">
            <Button
              onClick={() => {
                setEditingTemplate(null);
                setTemplateForm({ title: "", subject: "", html_content: "" });
                setTemplateDialogOpen(true);
              }}
              className="rounded-xl gap-2 w-full"
            >
              <Plus className="h-4 w-4" /> New Template
            </Button>

            {templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>No templates yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((t) => (
                  <div key={t.id} className="bg-card rounded-2xl border p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{t.title}</h3>
                        <p className="text-sm text-muted-foreground">{t.subject}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-xl h-8 w-8"
                          onClick={() => setTemplatePreview(t)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-xl h-8 w-8"
                          onClick={() => {
                            setEditingTemplate(t.id);
                            setTemplateForm({ title: t.title, subject: t.subject, html_content: t.html_content });
                            setTemplateDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-xl h-8 w-8 text-destructive"
                          onClick={() => deleteTemplate(t.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>No emails sent yet</p>
              </div>
            ) : (
              history.map((h) => (
                <div
                  key={h.id}
                  className="bg-card rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setHistoryDetail(h)}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{h.subject}</h3>
                      <p className="text-sm text-muted-foreground">
                        {h.recipient_count} recipient{h.recipient_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {h.status === "sent" ? (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Sent
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {h.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(h.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="border rounded-xl overflow-hidden">
            <div dangerouslySetInnerHTML={{ __html: wrappedPreview }} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Form Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Template Name</label>
              <Input
                value={templateForm.title}
                onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Subject</label>
              <Input
                value={templateForm.subject}
                onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">HTML Content</label>
              <Textarea
                value={templateForm.html_content}
                onChange={(e) => setTemplateForm({ ...templateForm, html_content: e.target.value })}
                className="rounded-xl min-h-[150px] font-mono text-sm"
              />
            </div>
            <Button onClick={saveTemplate} className="w-full rounded-xl">
              {editingTemplate ? "Update" : "Create"} Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Preview Modal */}
      <Dialog open={!!templatePreview} onOpenChange={() => setTemplatePreview(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{templatePreview?.title}</DialogTitle>
          </DialogHeader>
          <div className="border rounded-xl overflow-hidden">
            <div
              dangerouslySetInnerHTML={{
                __html: `
                  <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
                    <div style="background:#f97316;color:#fff;padding:20px 24px;text-align:center;">
                      <h2 style="margin:0;font-size:22px;">p4no</h2>
                    </div>
                    <div style="padding:24px;color:#333;">${templatePreview?.html_content || ""}</div>
                    <div style="background:#fafafa;padding:16px;text-align:center;color:#888;font-size:12px;border-top:1px solid #eee;">
                      © 2026 p4no | support@smartmarket.com
                    </div>
                  </div>`,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* History Detail Modal */}
      <Dialog open={!!historyDetail} onOpenChange={() => setHistoryDetail(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{historyDetail?.subject}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="font-medium">Status:</span>{" "}
              <span className={historyDetail?.status === "sent" ? "text-green-600" : "text-amber-600"}>
                {historyDetail?.status}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Recipients:</span> {historyDetail?.recipient_count}
            </div>
            <div className="text-sm">
              <span className="font-medium">Sent:</span> {historyDetail && new Date(historyDetail.created_at).toLocaleString()}
            </div>
            {historyDetail?.error_message && (
              <div className="text-sm text-destructive">
                <span className="font-medium">Errors:</span> {historyDetail.error_message}
              </div>
            )}
            <div className="border rounded-xl overflow-hidden mt-3">
              <div
                dangerouslySetInnerHTML={{
                  __html: `
                    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
                      <div style="background:#f97316;color:#fff;padding:20px 24px;text-align:center;">
                        <h2 style="margin:0;font-size:22px;">p4no</h2>
                      </div>
                      <div style="padding:24px;color:#333;">${historyDetail?.html_body || ""}</div>
                      <div style="background:#fafafa;padding:16px;text-align:center;color:#888;font-size:12px;border-top:1px solid #eee;">
                        © 2026 p4no | support@smartmarket.com
                      </div>
                    </div>`,
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailCenter;
