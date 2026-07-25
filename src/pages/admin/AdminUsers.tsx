import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, Search, Shield, Ban, ArrowLeft, RefreshCw, CheckCircle, 
  XCircle, Trash2, Edit, AlertTriangle, Phone, MapPin, Calendar,
  MessageSquare, Building, AtSign, Image, Send, Eye, Mail, UserX, IdCard, Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const AdminUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Manage dialog
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  
  // Sub-dialogs
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockType, setBlockType] = useState<'block' | 'ban'>('block');
  const [actionLoading, setActionLoading] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState({ title: '', message: '' });

  const [editData, setEditData] = useState({
    full_name: '', email: '', phone_number: '', whatsapp_number: '',
    call_number: '', user_type: '', location: '', bio: '',
    business_name: '', status: '', identity_verified: false, referral_code: '',
  });

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchUserRoles = async (userId: string) => {
    setRolesLoading(true);
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    setSelectedUserRoles((data || []).map((r: any) => r.role));
    setRolesLoading(false);
  };

  const openManageDialog = (user: any) => {
    setSelectedUser(user);
    setShowManageDialog(true);
    setSelectedUserRoles([]);
    fetchUserRoles(user.id);
  };

  const toggleRole = async (role: 'buyer' | 'seller' | 'admin') => {
    if (!selectedUser) return;
    const has = selectedUserRoles.includes(role);
    if (has) {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', selectedUser.id).eq('role', role);
      if (error) { toast({ title: `Failed to remove ${role}`, variant: 'destructive' }); return; }
      toast({ title: `Removed ${role} role` });
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: selectedUser.id, role });
      if (error) { toast({ title: `Failed to add ${role}`, variant: 'destructive' }); return; }
      toast({ title: `Added ${role} role` });
    }
    fetchUserRoles(selectedUser.id);
  };

  const openEditDialog = () => {
    if (!selectedUser) return;
    setEditData({
      full_name: selectedUser.full_name || '',
      email: selectedUser.email || '',
      phone_number: selectedUser.phone_number || '',
      whatsapp_number: selectedUser.whatsapp_number || '',
      call_number: selectedUser.call_number || '',
      user_type: selectedUser.user_type || 'buyer',
      location: selectedUser.location || '',
      bio: selectedUser.bio || '',
      business_name: selectedUser.business_name || '',
      status: selectedUser.status || 'active',
      identity_verified: selectedUser.identity_verified || false,
      referral_code: selectedUser.referral_code || '',
    });
    setShowEditDialog(true);
  };

  const openBlockDialog = (type: 'block' | 'ban') => {
    setBlockType(type);
    setBlockReason("");
    setShowBlockDialog(true);
  };

  const handleBlockOrBan = async () => {
    if (!selectedUser || !blockReason.trim()) {
      toast({ title: "Please provide a reason", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    const newStatus = blockType === 'block' ? 'blocked' : 'banned';
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus, blocking_reason: blockReason.trim() })
      .eq('id', selectedUser.id);
    if (error) {
      toast({ title: `Failed to ${blockType} user`, variant: "destructive" });
    } else {
      toast({ title: `User ${newStatus} successfully` });
      fetchUsers();
      setShowBlockDialog(false);
      setShowManageDialog(false);
    }
    setActionLoading(false);
  };

  const handleActivate = async () => {
    if (!selectedUser) return;
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'active', blocking_reason: null })
      .eq('id', selectedUser.id);
    if (!error) {
      toast({ title: "User activated" });
      fetchUsers();
      setShowManageDialog(false);
    } else toast({ title: "Failed to activate", variant: "destructive" });
  };

  const handleMarkVerified = async () => {
    if (!selectedUser) return;
    const { error } = await supabase
      .from('profiles')
      .update({ identity_verified: true })
      .eq('id', selectedUser.id);
    if (!error) {
      toast({ title: "User marked as verified" });
      fetchUsers();
      setShowManageDialog(false);
    } else toast({ title: "Failed to verify", variant: "destructive" });
  };

  const handleUnverify = async () => {
    if (!selectedUser) return;
    const { error } = await supabase
      .from('profiles')
      .update({ identity_verified: false })
      .eq('id', selectedUser.id);
    if (!error) {
      toast({ title: "Verification removed" });
      fetchUsers();
      setShowManageDialog(false);
    } else toast({ title: "Failed", variant: "destructive" });
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    if (!confirm('Are you sure? This action cannot be undone.')) return;
    setActionLoading(true);
    const { error } = await supabase.from('profiles').delete().eq('id', selectedUser.id);
    if (!error) {
      toast({ title: "User deleted" });
      fetchUsers();
      setShowManageDialog(false);
    } else toast({ title: "Failed to delete user", variant: "destructive" });
    setActionLoading(false);
  };

  const handleDisable2FA = async () => {
    if (!selectedUser) return;
    const { error } = await supabase.from('user_security').update({ two_factor_enabled: false, secret_key: null }).eq('user_id', selectedUser.id);
    if (!error) {
      await supabase.from('user_preferences').update({ two_factor_enabled: false }).eq('user_id', selectedUser.id);
      toast({ title: "2FA disabled for this user" });
    } else toast({ title: "No 2FA record found" });
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    const prevType = selectedUser.user_type;
    const newType = editData.user_type;
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editData.full_name,
        phone_number: editData.phone_number,
        whatsapp_number: editData.whatsapp_number,
        call_number: editData.call_number,
        user_type: editData.user_type,
        location: editData.location,
        bio: editData.bio,
        business_name: editData.business_name,
        status: editData.status,
        identity_verified: editData.identity_verified,
        referral_code: editData.referral_code,
      })
      .eq('id', selectedUser.id);
    if (!error) {
      if (prevType !== newType) {
        // Sync user_roles so dashboards/permissions reflect new type
        try {
          if (newType === 'seller') {
            await supabase.from('user_roles').insert({ user_id: selectedUser.id, role: 'seller' } as any);
          } else if (newType === 'buyer') {
            await supabase.from('user_roles').delete().eq('user_id', selectedUser.id).eq('role', 'seller');
          }
        } catch {}
        // Notify the user about the change
        await supabase.from('notifications').insert({
          user_id: selectedUser.id,
          title: newType === 'seller' ? 'You are now a Seller on P4NO' : 'Account type updated',
          message: newType === 'seller'
            ? 'Welcome! Please complete your seller profile to start selling and access your Seller Dashboard.'
            : `Your account type was changed to ${newType}.`,
          type: 'account',
        });
      }
      toast({ title: "User updated" });
      fetchUsers();
      setShowEditDialog(false);
      setShowManageDialog(false);
    } else toast({ title: "Failed to update", variant: "destructive" });
    setActionLoading(false);
  };

  const handleSendNotification = async () => {
    if (!selectedUser || !notificationMessage.title || !notificationMessage.message) return;
    const { error } = await supabase.from('notifications').insert({
      user_id: selectedUser.id,
      title: notificationMessage.title,
      message: notificationMessage.message,
      type: 'admin',
    });
    if (!error) {
      toast({ title: "Notification sent!" });
      setShowNotificationDialog(false);
      setNotificationMessage({ title: '', message: '' });
    } else toast({ title: "Failed to send", variant: "destructive" });
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) { navigate('/'); return null; }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/admin')} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Users</h1>
            <p className="text-xs text-muted-foreground">{users.length} total</p>
          </div>
          <Button variant="outline" size="icon" className="rounded-xl" onClick={fetchUsers}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-card"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-xl p-3 border text-center">
            <Users className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold">{users.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-card rounded-xl p-3 border text-center">
            <Shield className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
            <p className="text-lg font-bold">{users.filter(u => u.identity_verified).length}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
          <div className="bg-card rounded-xl p-3 border text-center">
            <AlertTriangle className="h-4 w-4 text-red-600 mx-auto mb-1" />
            <p className="text-lg font-bold">{users.filter(u => u.status === 'blocked' || u.status === 'banned').length}</p>
            <p className="text-xs text-muted-foreground">Restricted</p>
          </div>
        </div>

        {/* User type breakdown */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card rounded-xl p-3 border text-center">
            <Store className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold">{users.filter(u => u.user_type === 'seller').length}</p>
            <p className="text-xs text-muted-foreground">Sellers</p>
          </div>
          <div className="bg-card rounded-xl p-3 border text-center">
            <Users className="h-4 w-4 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-bold">{users.filter(u => u.user_type === 'buyer' || !u.user_type).length}</p>
            <p className="text-xs text-muted-foreground">Buyers</p>
          </div>
        </div>

        {/* Simplified User List */}
        <div className="bg-card rounded-2xl border overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">{filteredUsers.length} Users</h3>
          </div>
          <div className="divide-y max-h-[60vh] overflow-y-auto">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} className="p-4"><Skeleton className="h-12" /></div>
              ))
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No users found</div>
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {user.identity_verified ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] gap-1">
                        <Shield className="h-3 w-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Unverified
                      </Badge>
                    )}
                    <Button size="sm" className="h-8 text-xs gap-1" onClick={() => openManageDialog(user)}>
                      <Eye className="h-3 w-3" />
                      Manage
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ===== MANAGE USER DIALOG ===== */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Manage User
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0">
                  {selectedUser.profile_image ? (
                    <img src={selectedUser.profile_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.full_name?.charAt(0) || 'U'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base truncate">{selectedUser.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge className={cn("text-[10px]",
                      (!selectedUser.status || selectedUser.status === 'active') ? "bg-green-100 text-green-700" :
                      selectedUser.status === 'blocked' ? "bg-orange-100 text-orange-700" :
                      "bg-red-100 text-red-700"
                    )}>{selectedUser.status || 'active'}</Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">{selectedUser.user_type}</Badge>
                    {selectedUser.identity_verified && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px] gap-0.5">
                        <Shield className="h-2.5 w-2.5" /> Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* User Details */}
              <div className="grid grid-cols-2 gap-2">
                <DetailCard icon={Phone} label="Phone" value={selectedUser.phone_number} />
                <DetailCard icon={MessageSquare} label="WhatsApp" value={selectedUser.whatsapp_number} />
                <DetailCard icon={Phone} label="Call Number" value={selectedUser.call_number} />
                <DetailCard icon={MapPin} label="Location" value={selectedUser.location} />
                <DetailCard icon={Calendar} label="Joined" value={selectedUser.created_at ? format(new Date(selectedUser.created_at), 'PP') : null} />
                <DetailCard icon={Users} label="Referral Code" value={selectedUser.referral_code} />
                {selectedUser.business_name && (
                  <DetailCard icon={Building} label="Business" value={selectedUser.business_name} span2 />
                )}
                {selectedUser.bio && (
                  <DetailCard icon={MessageSquare} label="Bio" value={selectedUser.bio} span2 />
                )}
                <DetailCard icon={AtSign} label="User ID" value={selectedUser.id} span2 mono />
                {selectedUser.referred_by && (
                  <DetailCard icon={Users} label="Referred By" value={selectedUser.referred_by} span2 />
                )}
                {selectedUser.country && (
                  <DetailCard icon={MapPin} label="Country" value={selectedUser.country} />
                )}
                {selectedUser.ip_address && (
                  <DetailCard icon={AtSign} label="IP Address" value={selectedUser.ip_address} />
                )}
              </div>

              {/* ID Photos */}
              {(selectedUser.id_front_photo || selectedUser.id_back_photo) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                    <Image className="h-3.5 w-3.5" />
                    Identity Documents
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedUser.id_front_photo && (
                      <div className="rounded-xl overflow-hidden border">
                        <p className="text-[10px] text-center text-muted-foreground py-1 bg-muted">Front</p>
                        <img src={selectedUser.id_front_photo} alt="ID Front" className="w-full h-24 object-cover cursor-pointer" onClick={() => window.open(selectedUser.id_front_photo, '_blank')} />
                      </div>
                    )}
                    {selectedUser.id_back_photo && (
                      <div className="rounded-xl overflow-hidden border">
                        <p className="text-[10px] text-center text-muted-foreground py-1 bg-muted">Back</p>
                        <img src={selectedUser.id_back_photo} alt="ID Back" className="w-full h-24 object-cover cursor-pointer" onClick={() => window.open(selectedUser.id_back_photo, '_blank')} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Block reason */}
              {selectedUser.blocking_reason && (selectedUser.status === 'blocked' || selectedUser.status === 'banned') && (
                <div className="bg-destructive/10 rounded-xl p-3">
                  <p className="text-xs text-destructive font-medium mb-1">Block/Ban Reason:</p>
                  <p className="text-sm text-destructive">{selectedUser.blocking_reason}</p>
                </div>
              )}

              {/* Roles */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Roles</p>
                <div className="flex flex-wrap gap-2">
                  {(['buyer', 'seller', 'admin'] as const).map(role => {
                    const active = selectedUserRoles.includes(role);
                    return (
                      <button
                        key={role}
                        disabled={rolesLoading}
                        onClick={() => toggleRole(role)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize",
                          active
                            ? role === 'admin'
                              ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400"
                              : role === 'seller'
                                ? "bg-primary/10 text-primary border-primary/30"
                                : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground border-transparent hover:bg-muted/70"
                        )}
                      >
                        {active ? '✓ ' : '+ '}{role}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">Tap to add or remove. Changes apply instantly.</p>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openEditDialog}>
                    <Edit className="h-3.5 w-3.5 text-blue-600" /> Edit Profile
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowNotificationDialog(true)}>
                    <Mail className="h-3.5 w-3.5 text-purple-600" /> Send Notification
                  </Button>
                  {(selectedUser.status === 'blocked' || selectedUser.status === 'banned') ? (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs text-green-700 border-green-200 hover:bg-green-50" onClick={handleActivate}>
                      <CheckCircle className="h-3.5 w-3.5" /> Activate
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs text-orange-700 border-orange-200 hover:bg-orange-50" onClick={() => openBlockDialog('block')}>
                      <Ban className="h-3.5 w-3.5" /> Block
                    </Button>
                  )}
                  {selectedUser.identity_verified ? (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs text-amber-700 border-amber-200 hover:bg-amber-50" onClick={handleUnverify}>
                      <XCircle className="h-3.5 w-3.5" /> Remove Verified
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleMarkVerified}>
                      <Shield className="h-3.5 w-3.5" /> Mark Verified
                    </Button>
                  )}
                  {selectedUser.status !== 'banned' && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs text-red-700 border-red-200 hover:bg-red-50" onClick={() => openBlockDialog('ban')}>
                      <UserX className="h-3.5 w-3.5" /> Ban User
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDisable2FA}>
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" /> Disable 2FA
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive border-destructive/20 hover:bg-destructive/5 col-span-2" onClick={handleDelete}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete User Permanently
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Block/Ban Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {blockType === 'block' ? <Ban className="h-5 w-5 text-orange-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              {blockType === 'block' ? 'Block' : 'Ban'} User
            </DialogTitle>
            <DialogDescription>
              {blockType === 'block' ? 'Blocked users cannot access the platform temporarily.' : 'Banned users are permanently restricted.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {selectedUser?.full_name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="font-medium text-sm">{selectedUser?.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedUser?.email}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Reason *</label>
              <Textarea
                placeholder={`Why are you ${blockType === 'block' ? 'blocking' : 'banning'} this user?`}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="rounded-xl"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBlockDialog(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleBlockOrBan}
              disabled={actionLoading || !blockReason.trim()}
              className={cn("rounded-xl", blockType === 'ban' ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700")}
            >
              {actionLoading ? "Processing..." : blockType === 'block' ? 'Block User' : 'Ban User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Dialog */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Send Notification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={notificationMessage.title} onChange={(e) => setNotificationMessage({ ...notificationMessage, title: e.target.value })} placeholder="Notification title..." className="mt-1.5" /></div>
            <div><Label>Message</Label><Textarea value={notificationMessage.message} onChange={(e) => setNotificationMessage({ ...notificationMessage, message: e.target.value })} placeholder="Enter message..." rows={3} className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>Cancel</Button>
            <Button onClick={handleSendNotification} className="gap-1.5"><Send className="h-4 w-4" />Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit User Profile
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-3 mt-4">
              <div><Label className="flex items-center gap-1.5 mb-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" />Full Name</Label>
                <Input value={editData.full_name} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} /></div>
              <div><Label className="flex items-center gap-1.5 mb-1.5"><AtSign className="h-3.5 w-3.5 text-muted-foreground" />Email (read-only)</Label>
                <Input value={editData.email} disabled className="bg-muted" /></div>
              <div><Label className="flex items-center gap-1.5 mb-1.5"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />Bio</Label>
                <Textarea value={editData.bio} onChange={(e) => setEditData({ ...editData, bio: e.target.value })} rows={2} /></div>
              <div><Label className="flex items-center gap-1.5 mb-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />Location</Label>
                <Input value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })} /></div>
            </TabsContent>
            <TabsContent value="contact" className="space-y-3 mt-4">
              <div><Label className="flex items-center gap-1.5 mb-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />Phone Number</Label>
                <Input value={editData.phone_number} onChange={(e) => setEditData({ ...editData, phone_number: e.target.value })} /></div>
              <div><Label className="flex items-center gap-1.5 mb-1.5"><MessageSquare className="h-3.5 w-3.5 text-green-600" />WhatsApp</Label>
                <Input value={editData.whatsapp_number} onChange={(e) => setEditData({ ...editData, whatsapp_number: e.target.value })} /></div>
              <div><Label className="flex items-center gap-1.5 mb-1.5"><Phone className="h-3.5 w-3.5 text-blue-600" />Call Number</Label>
                <Input value={editData.call_number} onChange={(e) => setEditData({ ...editData, call_number: e.target.value })} /></div>
              <div><Label className="flex items-center gap-1.5 mb-1.5"><Building className="h-3.5 w-3.5 text-muted-foreground" />Business Name</Label>
                <Input value={editData.business_name} onChange={(e) => setEditData({ ...editData, business_name: e.target.value })} /></div>
            </TabsContent>
            <TabsContent value="account" className="space-y-3 mt-4">
              <div><Label className="flex items-center gap-1.5 mb-1.5"><Store className="h-3.5 w-3.5 text-muted-foreground" />User Type</Label>
                <Select value={editData.user_type} onValueChange={(v) => setEditData({ ...editData, user_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="buyer">Buyer</SelectItem><SelectItem value="seller">Seller</SelectItem></SelectContent>
                </Select></div>
              <div><Label className="flex items-center gap-1.5 mb-1.5"><Shield className="h-3.5 w-3.5 text-muted-foreground" />Status</Label>
                <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="blocked">Blocked</SelectItem><SelectItem value="banned">Banned</SelectItem></SelectContent>
                </Select></div>
              <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <input type="checkbox" id="edit_verified" checked={editData.identity_verified} onChange={(e) => setEditData({ ...editData, identity_verified: e.target.checked })} className="h-4 w-4 accent-primary" />
                <Label htmlFor="edit_verified" className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <IdCard className="h-3.5 w-3.5 text-emerald-600" /> Identity Verified (Admin Override)
                </Label>
              </div>
              <div><Label className="flex items-center gap-1.5 mb-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" />Referral Code</Label>
                <Input value={editData.referral_code} onChange={(e) => setEditData({ ...editData, referral_code: e.target.value })} /></div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={actionLoading} className="gap-1.5">
              <CheckCircle className="h-4 w-4" /> {actionLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helper component for detail cards in the manage dialog
const DetailCard = ({ icon: Icon, label, value, span2, mono }: {
  icon: any; label: string; value: string | null | undefined; span2?: boolean; mono?: boolean;
}) => (
  <div className={cn("bg-muted/50 rounded-xl p-2.5", span2 && "col-span-2")}>
    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
      <Icon className="h-3 w-3" />
      <span className="text-[10px] uppercase tracking-wide font-medium">{label}</span>
    </div>
    <p className={cn("text-sm font-medium truncate", mono && "font-mono text-xs break-all")}>{value || 'N/A'}</p>
  </div>
);

export default AdminUsers;
