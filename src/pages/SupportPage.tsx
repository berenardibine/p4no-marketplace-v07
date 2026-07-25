import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, MessageCircle, Phone, Mail, Clock, 
  Send, CheckCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SupportPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  
  const [formData, setFormData] = useState({
    name: profile?.full_name || "",
    email: user?.email || "",
    subject: "",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('contact_messages')
        .insert({
          name: formData.name,
          email: formData.email,
          message: `[${formData.subject}] ${formData.message}`,
        });

      if (error) throw error;
      setSubmitted(true);
      toast({ title: "Message sent successfully!" });
    } catch (err: any) {
      toast({ 
        title: "Failed to send message", 
        description: err.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 mx-auto flex items-center justify-center mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
          <p className="text-muted-foreground mb-6">
            We'll get back to you within 24 hours
          </p>
          <Button onClick={() => navigate('/')} className="rounded-xl">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary to-orange-500 pt-safe pb-6">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg text-white">Contact Support</h1>
        </div>
      </div>

      {/* Quick Contact Options */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <a href="tel:+250798751685" className="bg-card rounded-xl p-4 border text-center hover:border-primary/50 transition-colors">
            <Phone className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium">Call Us</p>
          </a>
          <a href="mailto:manishimweberenard@gmail.com" className="bg-card rounded-xl p-4 border text-center hover:border-primary/50 transition-colors">
            <Mail className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium">Email</p>
          </a>
          <div className="bg-card rounded-xl p-4 border text-center">
            <Clock className="h-6 w-6 text-amber-600 mx-auto mb-2" />
            <p className="text-sm font-medium">24/7</p>
          </div>
        </div>
      </div>

      {/* Contact Form */}
      <div className="p-4">
        <div className="bg-card rounded-2xl p-5 border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Send us a message
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Your Name</label>
              <Input
                placeholder="Enter your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12 rounded-xl"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Email Address</label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-12 rounded-xl"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Subject</label>
              <Select 
                value={formData.subject} 
                onValueChange={(value) => setFormData({ ...formData, subject: value })}
              >
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select a topic" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="general">General Inquiry</SelectItem>
                  <SelectItem value="account">Account Issues</SelectItem>
                  <SelectItem value="payment">Payment Problems</SelectItem>
                  <SelectItem value="seller">Seller Support</SelectItem>
                  <SelectItem value="report">Report an Issue</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Message</label>
              <Textarea
                placeholder="Describe your issue or question..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={5}
                className="rounded-xl resize-none"
              />
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={loading}
              className="w-full h-12 rounded-xl gap-2"
            >
              <Send className="h-4 w-4" />
              {loading ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        
      </div>
    </div>
  );
};

export default SupportPage;
