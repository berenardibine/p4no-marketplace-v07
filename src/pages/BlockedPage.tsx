import { useState, useEffect } from "react";
import { ShieldX, Mail, Phone, User, Send, MessageSquare, Home, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

const BlockedPage = () => {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const [blockReason, setBlockReason] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [sending, setSending] = useState(false);

  // Get blocking reason from localStorage (set when user is blocked in real-time) or from profile
  useEffect(() => {
    const storedReason = localStorage.getItem('blocked_reason');
    if (storedReason) {
      setBlockReason(storedReason);
    } else if (profile?.blocking_reason) {
      setBlockReason(profile.blocking_reason);
    } else {
      setBlockReason('Violation of platform terms');
    }
    
    // Pre-fill form with profile data if available
    if (profile) {
      setFormData(prev => ({
        ...prev,
        name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone_number || '',
      }));
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message.trim()) {
      toast({ title: "Please enter a message", variant: "destructive" });
      return;
    }

    setSending(true);

    const { error } = await supabase.from('contact_messages').insert({
      name: formData.name,
      email: formData.email,
      phone_number: formData.phone,
      message: `[BLOCKED USER SUPPORT REQUEST]\n\n${formData.message}`,
    });

    if (error) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } else {
      toast({ title: "Message sent!", description: "Our team will review your request." });
      setFormData({ ...formData, message: '' });
    }

    setSending(false);
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Blocked Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <ShieldX className="h-10 w-10 text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Account Blocked
          </h1>
          
          <p className="text-muted-foreground mb-4">
            Your account has been blocked by the administrator.
          </p>

          {blockReason && (
            <div className="bg-red-50 rounded-xl p-4 mb-6 text-left border border-red-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-600 mb-1">Reason:</p>
                  <p className="text-sm text-red-700">{blockReason}</p>
                </div>
              </div>
            </div>
          )}

          <Button 
            variant="outline" 
            onClick={handleSignOut}
            className="w-full"
          >
            Sign Out
          </Button>
        </div>

        {/* Contact Support Form */}
        <div className="bg-white rounded-3xl shadow-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Contact Support</h2>
              <p className="text-sm text-muted-foreground">Appeal or ask questions</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="+250 7XX XXX XXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Your Message *</label>
              <Textarea
                placeholder="Explain your situation or ask for clarification..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full gap-2"
              disabled={sending}
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending...' : 'Send Message'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          p4no Support Team
        </p>
      </div>
    </div>
  );
};

export default BlockedPage;
