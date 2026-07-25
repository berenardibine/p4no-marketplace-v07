import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Flag, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string;
  sellerId?: string;
  productTitle?: string;
  sellerName?: string;
}

const REPORT_REASONS = [
  'Misleading information',
  'Inappropriate content',
  'Suspected fraud/scam',
  'Fake product',
  'Wrong category',
  'Other'
];

const ReportModal = ({ isOpen, onClose, productId, sellerId, productTitle, sellerName }: ReportModalProps) => {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<'product' | 'seller'>(productId ? 'product' : 'seller');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim() || !reason) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('submit-report', {
        body: {
          productId: reportType === 'product' ? productId : null,
          sellerId: reportType === 'seller' ? sellerId : null,
          reporterName: name,
          reporterPhone: phone,
          reporterEmail: email || null,
          reason,
          details: details || null,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      
      setSubmitted(true);
      toast({ title: 'Report submitted successfully', description: 'We will review it shortly.' });
    } catch (error: any) {
      toast({ title: 'Failed to submit report', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setName('');
    setPhone('');
    setEmail('');
    setReason('');
    setDetails('');
    onClose();
  };

  if (submitted) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Report Submitted</h3>
            <p className="text-muted-foreground mb-6">
              Thank you for helping us keep p4no safe. We will review your report and take action if needed.
            </p>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-500" />
            Report {reportType === 'product' ? 'Product' : 'Seller'}
          </DialogTitle>
          <DialogDescription>
            Help us keep p4no safe by reporting inappropriate content.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Report Type */}
          <div className="space-y-2">
            <Label>What would you like to report?</Label>
            <RadioGroup value={reportType} onValueChange={(v) => setReportType(v as 'product' | 'seller')}>
              {productId && (
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent">
                  <RadioGroupItem value="product" id="product" />
                  <Label htmlFor="product" className="flex-1 cursor-pointer">
                    <span className="font-medium">Product</span>
                    {productTitle && <span className="text-sm text-muted-foreground block">{productTitle}</span>}
                  </Label>
                </div>
              )}
              {sellerId && (
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent">
                  <RadioGroupItem value="seller" id="seller" />
                  <Label htmlFor="seller" className="flex-1 cursor-pointer">
                    <span className="font-medium">Seller</span>
                    {sellerName && <span className="text-sm text-muted-foreground block">{sellerName}</span>}
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Your Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email (Optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason for Report *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <Label htmlFor="details">Additional Details (Optional)</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide more information about your report..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-red-500 hover:bg-red-600">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportModal;
