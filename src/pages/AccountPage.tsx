import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Mail, Phone, MapPin, Calendar, Edit,
  Camera, Shield, Bell, Lock, LogOut, ChevronRight, Eye,
  CheckCircle, Smartphone, Gift, Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import EditProfileModal from "@/components/account/EditProfileModal";
import ChangePasswordModal from "@/components/account/ChangePasswordModal";
import ReferralSummaryCard from "@/components/referral/ReferralSummaryCard";

const AccountPage = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { toast } = useToast();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  if (!user) {
    navigate('/auth');
    return null;
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const isVerified = (profile as any)?.identity_verified;

  const menuItems = [
    { icon: Gift, label: "Refer & Earn", href: "/referrals", color: "bg-gradient-to-br from-primary to-orange-500" },
    { icon: Wallet, label: "My Wallet", href: "/wallet", color: "bg-emerald-500" },
    { icon: Edit, label: "Edit Profile", action: () => setShowEditProfile(true), color: "bg-blue-500" },
    { icon: Eye, label: "View Public Profile", href: `/seller/${user.id}`, color: "bg-purple-500" },
    { icon: Lock, label: "Change Password", action: () => setShowChangePassword(true), color: "bg-amber-500" },
    { icon: Smartphone, label: "Connected Devices", href: "/settings", color: "bg-green-500" },
    { icon: Bell, label: "Notification Settings", href: "/settings", color: "bg-pink-500" },
    { icon: Shield, label: "Privacy & Security", href: "/settings", color: "bg-cyan-500" },
  ];

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logged out",
      description: "You have logged out successfully.",
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary to-orange-500 pt-safe">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg text-white">My Account</h1>
        </div>
      </div>

      {/* Profile Card */}
      <div className="p-4 -mt-2">
        <div className="bg-card rounded-2xl p-6 border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center overflow-hidden">
                {profile?.profile_image ? (
                  <img src={profile.profile_image} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-3xl">{initials}</span>
                )}
              </div>
              <button 
                onClick={() => setShowEditProfile(true)}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow-lg"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-xl">{displayName}</h2>
                {isVerified && (
                  <CheckCircle className="h-5 w-5 text-blue-500 fill-blue-500" />
                )}
              </div>
              <Badge className="mt-1 bg-primary/10 text-primary capitalize">
                {profile?.user_type || 'Member'}
              </Badge>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="text-sm">{user?.email}</span>
            </div>
            {profile?.phone_number && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span className="text-sm">{profile.phone_number}</span>
              </div>
            )}
            {(profile as any)?.location && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{(profile as any).location}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">
                Member since {(profile as any)?.created_at ? format(new Date((profile as any).created_at), 'MMM yyyy') : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Referral & Rewards Summary */}
      <div className="px-4 mb-4">
        <ReferralSummaryCard />
      </div>

      {/* Menu Items */}
      <div className="px-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={() => item.action ? item.action() : item.href && navigate(item.href)}
            className="w-full flex items-center gap-3 p-4 bg-card rounded-xl border hover:bg-accent transition-colors"
          >
            <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center`}>
              <item.icon className="h-5 w-5 text-white" />
            </div>
            <span className="flex-1 text-left font-medium">{item.label}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <div className="px-4 mt-6">
        <Button 
          onClick={handleLogout}
          variant="outline" 
          className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 gap-2"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </Button>
      </div>

      {/* Modals */}
      <EditProfileModal 
        open={showEditProfile} 
        onClose={() => setShowEditProfile(false)} 
      />
      <ChangePasswordModal 
        open={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
      />
    </div>
  );
};

export default AccountPage;