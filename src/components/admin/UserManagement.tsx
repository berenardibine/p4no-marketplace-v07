import { useState, useEffect } from "react";
import { 
  Users, Store, Eye, Trash2, Ban, CheckCircle, Search, Edit, Mail, 
  Send, Phone, MapPin, Calendar, UserX, RefreshCw, User, AtSign, Building,
  IdCard, MessageSquare, Shield, AlertTriangle, Image
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
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const UserManagement = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [notificationMessage, setNotificationMessage] = useState({ title: '', message: '' });
  
  const [editData, setEditData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    whatsapp_number: '',
    call_number: '',
    user_type: '',
    location: '',
    bio: '',
    business_name: '',
    status: '',
    identity_verified: false,
    referral_code: '',
  });

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.phone_number?.includes(searchQuery)
  );

  const handleBlockUser = async (withReason: boolean = false) => {
    if (!selectedUser) return;
    const { error } = await supabase
      .from('profiles')
      .update({ 
        status: 'blocked',
        blocking_reason: withReason ? blockReason : 'Violation of terms'
      })
      .eq('id', selectedUser.id);

    if (error) {
      toast({ title: "Failed to block user", variant: "destructive" });
    } else {
      toast({ title: "User blocked successfully" });
      fetchUsers();
      setShowBlockDialog(false);
      setShowManageDialog(false);
      setBlockReason("");
    }
  };

  const handleBanUser = async (id: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'banned' })
      .eq('id', id);

    if (error) {
      toast({ title: "Failed to ban user", variant: "destructive" });
    } else {
      toast({ title: "User banned permanently" });
      fetchUsers();
      setShowManageDialog(false);
    }
  };

  const handleActivateUser = async (id: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'active', blocking_reason: null })
      .eq('id', id);

    if (error) {
      toast({ title: "Failed to activate user", variant: "destructive" });
    } else {
      toast({ title: "User activated successfully" });
      fetchUsers();
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure? This permanently deletes the account from authentication and cannot be undone.')) return;
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: id },
      });
      if (error || (data as any)?.error) {
        toast({ title: 'Failed to delete user', description: error?.message || (data as any)?.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'User fully deleted (profile + auth)' });
      fetchUsers();
      setShowManageDialog(false);
    } catch (e: any) {
      toast({ title: 'Failed to delete user', description: e.message, variant: 'destructive' });
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editData.full_name,
        email: editData.email,
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

    if (error) {
      toast({ title: "Failed to update user", variant: "destructive" });
    } else {
      toast({ title: "User updated successfully" });
      fetchUsers();
      setShowEditDialog(false);
    }
  };

  const handleSendNotification = async () => {
    if (!selectedUser || !notificationMessage.title || !notificationMessage.message) return;
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: selectedUser.id,
        title: notificationMessage.title,
        message: notificationMessage.message,
        type: 'admin',
      });

    if (error) {
      toast({ title: "Failed to send notification", variant: "destructive" });
    } else {
      toast({ title: "Notification sent!" });
      setShowNotificationDialog(false);
      setNotificationMessage({ title: '', message: '' });
    }
  };

  const openEditDialog = (user: any) => {
    setSelectedUser(user);
    setEditData({
      full_name: user.full_name || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      whatsapp_number: user.whatsapp_number || '',
      call_number: user.call_number || '',
      user_type: user.user_type || 'buyer',
      location: user.location || '',
      bio: user.bio || '',
      business_name: user.business_name || '',
      status: user.status || 'active',
      identity_verified: user.identity_verified || false,
      referral_code: user.referral_code || '',
    });
    setShowEditDialog(true);
  };

  const openManageDialog = (user: any) => {
    setSelectedUser(user);
    setShowManageDialog(true);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-white"
          />
        </div>
        <Button variant="outline" size="icon" className="h-12 w-12" onClick={fetchUsers}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats — Sellers / Buyers explicit (no guests) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Total</span>
          </div>
          <p className="text-2xl font-bold">{users.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold">{users.filter(u => u.status === 'active' || !u.status).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <Store className="h-4 w-4" />
            <span className="text-xs font-medium">Sellers</span>
          </div>
          <p className="text-2xl font-bold">{users.filter(u => u.user_type === 'seller').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <User className="h-4 w-4" />
            <span className="text-xs font-medium">Buyers</span>
          </div>
          <p className="text-2xl font-bold">{users.filter(u => u.user_type === 'buyer').length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <UserX className="h-4 w-4" />
            <span className="text-xs font-medium">Blocked</span>
          </div>
          <p className="text-2xl font-bold">{users.filter(u => u.status === 'blocked' || u.status === 'banned').length}</p>
        </div>
      </div>

      {/* Simplified User List: name, email, verification, manage button */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-white">
          <h3 className="font-semibold">All Users ({filteredUsers.length})</h3>
        </div>
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="p-4"><Skeleton className="h-14" /></div>
            ))
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No users found</div>
          ) : (
            filteredUsers.map(user => (
              <div key={user.id} className="p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {user.identity_verified ? (
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px] gap-1">
                      <Shield className="h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Unverified
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => openManageDialog(user)}
                  >
                    <Eye className="h-3 w-3" />
                    Manage
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Full Manage User Dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="max-w-md bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Manage User
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                  {selectedUser.profile_image ? (
                    <img src={selectedUser.profile_image} alt={selectedUser.full_name} className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.full_name?.charAt(0) || 'U'
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{selectedUser.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn(
                      "text-xs",
                      (!selectedUser.status || selectedUser.status === 'active')
                        ? "bg-green-100 text-green-700"
                        : selectedUser.status === 'blocked'
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    )}>
                      {selectedUser.status || 'active'}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">{selectedUser.user_type}</Badge>
                    {selectedUser.identity_verified && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs gap-1">
                        <Shield className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* User Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Phone className="h-3 w-3" />
                    <span className="text-xs">Phone</span>
                  </div>
                  <p className="font-medium text-sm">{selectedUser.phone_number || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MessageSquare className="h-3 w-3" />
                    <span className="text-xs">WhatsApp</span>
                  </div>
                  <p className="font-medium text-sm">{selectedUser.whatsapp_number || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Phone className="h-3 w-3" />
                    <span className="text-xs">Call Number</span>
                  </div>
                  <p className="font-medium text-sm">{selectedUser.call_number || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3" />
                    <span className="text-xs">Location</span>
                  </div>
                  <p className="font-medium text-sm">{selectedUser.location || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-3 w-3" />
                    <span className="text-xs">Joined</span>
                  </div>
                  <p className="font-medium text-sm">
                    {selectedUser.created_at ? format(new Date(selectedUser.created_at), 'PP') : 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="h-3 w-3" />
                    <span className="text-xs">Referral Code</span>
                  </div>
                  <p className="font-medium text-sm">{selectedUser.referral_code || 'N/A'}</p>
                </div>
                {selectedUser.business_name && (
                  <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Building className="h-3 w-3" />
                      <span className="text-xs">Business Name</span>
                    </div>
                    <p className="font-medium text-sm">{selectedUser.business_name}</p>
                  </div>
                )}
                {selectedUser.bio && (
                  <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <MessageSquare className="h-3 w-3" />
                      <span className="text-xs">Bio</span>
                    </div>
                    <p className="font-medium text-sm">{selectedUser.bio}</p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <AtSign className="h-3 w-3" />
                    <span className="text-xs">User ID</span>
                  </div>
                  <p className="font-mono text-xs break-all">{selectedUser.id}</p>
                </div>
                {selectedUser.referred_by && (
                  <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="h-3 w-3" />
                      <span className="text-xs">Referred By</span>
                    </div>
                    <p className="font-medium text-sm">{selectedUser.referred_by}</p>
                  </div>
                )}
              </div>

              {/* ID Photos if verified */}
              {selectedUser.identity_verified && (selectedUser.id_front_photo || selectedUser.id_back_photo) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    Identity Documents
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedUser.id_front_photo && (
                      <div className="rounded-xl overflow-hidden border">
                        <p className="text-[10px] text-center text-muted-foreground py-1 bg-gray-50">Front</p>
                        <img src={selectedUser.id_front_photo} alt="ID Front" className="w-full h-24 object-cover" />
                      </div>
                    )}
                    {selectedUser.id_back_photo && (
                      <div className="rounded-xl overflow-hidden border">
                        <p className="text-[10px] text-center text-muted-foreground py-1 bg-gray-50">Back</p>
                        <img src={selectedUser.id_back_photo} alt="ID Back" className="w-full h-24 object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedUser.blocking_reason && (
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-xs text-red-600 font-medium mb-1">Block Reason:</p>
                  <p className="text-sm text-red-700">{selectedUser.blocking_reason}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                    setShowManageDialog(false);
                    openEditDialog(selectedUser);
                  }}>
                    <Edit className="h-4 w-4 text-blue-600" />
                    Edit Profile
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowNotificationDialog(true)}>
                    <Mail className="h-4 w-4 text-purple-600" />
                    Send Notification
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => handleActivateUser(selectedUser.id)}>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Activate
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={async () => {
                    const { error } = await supabase.from('profiles').update({ identity_verified: true }).eq('id', selectedUser.id);
                    if (!error) { toast({ title: "User marked as verified" }); fetchUsers(); setShowManageDialog(false); }
                    else toast({ title: "Failed to verify", variant: "destructive" });
                  }}>
                    <Shield className="h-4 w-4" />
                    Mark Verified
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-yellow-700 border-yellow-200 hover:bg-yellow-50" onClick={() => setShowBlockDialog(true)}>
                    <Ban className="h-4 w-4" />
                    Block User
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-orange-700 border-orange-200 hover:bg-orange-50" onClick={() => handleBanUser(selectedUser.id)}>
                    <UserX className="h-4 w-4" />
                    Ban User
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/5" onClick={() => handleDeleteUser(selectedUser.id)}>
                    <Trash2 className="h-4 w-4" />
                    Delete User
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/5" onClick={async () => {
                    const { error } = await supabase.from('user_security').update({ two_factor_enabled: false, secret_key: null }).eq('user_id', selectedUser.id);
                    if (!error) {
                      await supabase.from('user_preferences').update({ two_factor_enabled: false }).eq('user_id', selectedUser.id);
                      toast({ title: "2FA disabled for this user" });
                    } else {
                      toast({ title: "No 2FA record found" });
                    }
                  }}>
                    <Shield className="h-4 w-4" />
                    Disable 2FA
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit User Profile
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Full Name *
                </Label>
                <Input id="full_name" value={editData.full_name} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} placeholder="Enter full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  Email *
                </Label>
                <Input id="email" type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} placeholder="Enter email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Bio
                </Label>
                <Textarea id="bio" value={editData.bio} onChange={(e) => setEditData({ ...editData, bio: e.target.value })} placeholder="User bio..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Location
                </Label>
                <Input id="location" value={editData.location} onChange={(e) => setEditData({ ...editData, location: e.target.value })} placeholder="Enter location" />
              </div>
            </TabsContent>
            
            <TabsContent value="contact" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="phone_number" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Phone Number
                </Label>
                <Input id="phone_number" value={editData.phone_number} onChange={(e) => setEditData({ ...editData, phone_number: e.target.value })} placeholder="+250..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp_number" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  WhatsApp Number
                </Label>
                <Input id="whatsapp_number" value={editData.whatsapp_number} onChange={(e) => setEditData({ ...editData, whatsapp_number: e.target.value })} placeholder="+250..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="call_number" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-600" />
                  Call Number
                </Label>
                <Input id="call_number" value={editData.call_number} onChange={(e) => setEditData({ ...editData, call_number: e.target.value })} placeholder="+250..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_name" className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  Business Name
                </Label>
                <Input id="business_name" value={editData.business_name} onChange={(e) => setEditData({ ...editData, business_name: e.target.value })} placeholder="Business name (for sellers)" />
              </div>
            </TabsContent>
            
            <TabsContent value="account" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  User Type
                </Label>
                <Select value={editData.user_type} onValueChange={(value) => setEditData({ ...editData, user_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="seller">Seller</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Account Status
                </Label>
                <Select value={editData.status} onValueChange={(value) => setEditData({ ...editData, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                <input
                  type="checkbox"
                  id="identity_verified"
                  checked={editData.identity_verified}
                  onChange={(e) => setEditData({ ...editData, identity_verified: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                <div>
                  <Label htmlFor="identity_verified" className="flex items-center gap-2 cursor-pointer">
                    <IdCard className="h-4 w-4 text-green-600" />
                    Identity Verified (Admin Override)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mark as verified without requiring identity documents.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="referral_code" className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Referral Code
                </Label>
                <Input id="referral_code" value={editData.referral_code} onChange={(e) => setEditData({ ...editData, referral_code: e.target.value })} placeholder="User's referral code" />
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEditUser} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader><DialogTitle>Block User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Provide a reason for blocking this user:</p>
            <Textarea value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Enter blocking reason..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleBlockUser(true)}>Block User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Dialog */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Send Notification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={notificationMessage.title} onChange={(e) => setNotificationMessage({ ...notificationMessage, title: e.target.value })} placeholder="Notification title..." />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={notificationMessage.message} onChange={(e) => setNotificationMessage({ ...notificationMessage, message: e.target.value })} placeholder="Enter your message..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>Cancel</Button>
            <Button onClick={handleSendNotification} className="gap-2"><Send className="h-4 w-4" />Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
