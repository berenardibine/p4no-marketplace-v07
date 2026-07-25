import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Smartphone, Monitor, LogOut, Loader2, Lock, 
  MapPin, Clock, Shield, AlertTriangle 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface Device {
  id: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  ip_address: string | null;
  location: string | null;
  last_active: string | null;
  is_current: boolean | null;
}

interface ConnectedDevicesModalProps {
  open: boolean;
  onClose: () => void;
}

const ConnectedDevicesModal = ({ open, onClose }: ConnectedDevicesModalProps) => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [loggingOut, setLoggingOut] = useState<string | null>(null);

  useEffect(() => {
    if (open && verified) {
      fetchDevices();
    }
  }, [open, verified]);

  const fetchDevices = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_active', { ascending: false });

      if (error) throw error;

      // If no sessions exist, create the current one
      if (!data || data.length === 0) {
        const browserInfo = getBrowserInfo();
        const { data: newSession } = await supabase
          .from('user_sessions')
          .insert({
            user_id: user.id,
            device_name: browserInfo.deviceName,
            device_type: browserInfo.deviceType,
            browser: browserInfo.browser,
            is_current: true,
          })
          .select()
          .single();
        
        setDevices(newSession ? [newSession] : []);
      } else {
        setDevices(data);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown Browser';
    let deviceType = 'desktop';
    let deviceName = 'Unknown Device';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    if (/Mobile|Android|iPhone|iPad/.test(ua)) {
      deviceType = 'mobile';
      deviceName = /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android Device' : 'Mobile Device';
    } else {
      deviceName = /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : 'Desktop';
    }

    return { browser, deviceType, deviceName };
  };

  const handleVerifyPassword = async () => {
    if (!password.trim()) {
      toast({ title: "Please enter your password", variant: "destructive" });
      return;
    }

    setVerifying(true);
    try {
      // Verify password by attempting to sign in
      const { error } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password,
      });

      if (error) throw error;

      setVerified(true);
      toast({ title: "Verified successfully!" });
    } catch (err: any) {
      toast({ 
        title: "Invalid password", 
        description: "Please enter your correct password",
        variant: "destructive" 
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleLogoutDevice = async (deviceId: string) => {
    setLoggingOut(deviceId);
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      toast({ title: "Device logged out successfully!" });
      fetchDevices();
    } catch (err: any) {
      toast({ 
        title: "Failed to logout device", 
        description: err.message,
        variant: "destructive" 
      });
    } finally {
      setLoggingOut(null);
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!confirm('This will log you out from all devices including this one. Continue?')) return;

    setLoggingOut('all');
    try {
      // Delete all sessions
      await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', user?.id);

      // Sign out
      await signOut();
      toast({ title: "Logged out from all devices!" });
      onClose();
    } catch (err: any) {
      toast({ 
        title: "Failed to logout", 
        description: err.message,
        variant: "destructive" 
      });
      setLoggingOut(null);
    }
  };

  const handleClose = () => {
    setVerified(false);
    setPassword('');
    onClose();
  };

  const getDeviceIcon = (type: string | null) => {
    return type === 'mobile' ? Smartphone : Monitor;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Connected Devices
          </DialogTitle>
        </DialogHeader>

        {!verified ? (
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">Security Verification</h4>
                <p className="text-sm text-amber-700 mt-1">
                  For your security, please enter your password to view connected devices.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleVerifyPassword} 
                disabled={verifying}
                className="flex-1"
              >
                {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-8">
                <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No devices found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {devices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.device_type);
                  return (
                    <div 
                      key={device.id}
                      className={`p-4 rounded-xl border ${
                        device.is_current ? 'bg-primary/5 border-primary/20' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          device.is_current ? 'bg-primary text-white' : 'bg-muted'
                        }`}>
                          <DeviceIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {device.device_name || 'Unknown Device'}
                            </p>
                            {device.is_current && (
                              <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {device.browser || 'Unknown Browser'}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {device.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {device.location}
                              </span>
                            )}
                            {device.last_active && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(device.last_active), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                        {!device.is_current && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLogoutDevice(device.id)}
                            disabled={loggingOut === device.id}
                            className="shrink-0"
                          >
                            {loggingOut === device.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <LogOut className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button 
              variant="destructive" 
              onClick={handleLogoutAllDevices}
              disabled={loggingOut === 'all'}
              className="w-full gap-2"
            >
              {loggingOut === 'all' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Log Out From All Devices
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ConnectedDevicesModal;
