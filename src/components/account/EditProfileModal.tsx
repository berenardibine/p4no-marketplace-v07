import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2 } from "lucide-react";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import { validateImageFile } from "@/lib/cloudinary";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
}

const EditProfileModal = ({ open, onClose }: EditProfileModalProps) => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { upload, isUploading } = useCloudinaryUpload({ folder: 'avatars' });
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    call_number: "",
    whatsapp_number: "",
    bio: "",
    business_name: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        call_number: (profile as any).call_number || profile.phone_number || "",
        whatsapp_number: (profile as any).whatsapp_number || profile.phone_number || "",
        bio: (profile as any).bio || "",
        business_name: (profile as any).business_name || "",
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    try {
      // Auto-fill: if user has only one number, use it for both
      const callNum = formData.call_number?.trim() || formData.whatsapp_number?.trim() || "";
      const whatsappNum = formData.whatsapp_number?.trim() || formData.call_number?.trim() || "";

      // Check for duplicate phone numbers
      if (callNum) {
        const { data: existingCall } = await supabase
          .from("profiles")
          .select("id")
          .neq("id", profile.id)
          .or(`call_number.eq.${callNum},phone_number.eq.${callNum},whatsapp_number.eq.${callNum}`)
          .limit(1)
          .maybeSingle();

        if (existingCall) {
          toast({
            title: "Phone number already used",
            description: "This phone number is already used by another account. Please use a different number.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      if (whatsappNum && whatsappNum !== callNum) {
        const { data: existingWhatsapp } = await supabase
          .from("profiles")
          .select("id")
          .neq("id", profile.id)
          .eq("whatsapp_number", whatsappNum)
          .limit(1)
          .maybeSingle();

        if (existingWhatsapp) {
          toast({
            title: "WhatsApp number already used",
            description: "This WhatsApp number is already used by another account. Please use a different number.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone_number: callNum,
          call_number: callNum,
          whatsapp_number: whatsappNum,
          bio: formData.bio,
          business_name: formData.business_name,
        })
        .eq("id", profile.id);

      if (error) throw error;

      // Sync updated numbers to all user's products
      if (callNum || whatsappNum) {
        await supabase
          .from("products")
          .update({
            contact_call: callNum || null,
            contact_whatsapp: whatsappNum || null,
          })
          .eq("seller_id", profile.id);

        // Sync to user's shops
        await supabase
          .from("shops")
          .update({
            contact_phone: callNum || null,
            whatsapp: whatsappNum || null,
          })
          .eq("seller_id", profile.id);
      }

      await refreshProfile();
      toast({
        title: "Profile updated",
        description: "Your profile and all listings have been updated!",
      });
      onClose();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast({ title: validationError, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const url = await upload(file);
      if (url) {
        await supabase
          .from("profiles")
          .update({ profile_image: url })
          .eq("id", profile.id);

        await refreshProfile();
        toast({ title: "Photo updated" });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Image */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center overflow-hidden">
                {profile?.profile_image ? (
                  <img src={profile.profile_image} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-3xl">
                    {formData.full_name.charAt(0).toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-lg">
                <Camera className="h-4 w-4" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                  disabled={loading}
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="call_number">Call Number</Label>
            <Input
              id="call_number"
              value={formData.call_number}
              onChange={(e) => setFormData({ ...formData, call_number: e.target.value })}
              placeholder="Enter your call number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
            <Input
              id="whatsapp_number"
              value={formData.whatsapp_number}
              onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              placeholder="Enter your WhatsApp number (leave empty to use call number)"
            />
            <p className="text-xs text-muted-foreground">Leave empty to use the same as call number</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name (Optional)</Label>
            <Input
              id="business_name"
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              placeholder="Enter your business name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell us about yourself"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProfileModal;