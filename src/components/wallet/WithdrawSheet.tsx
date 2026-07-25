import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useGrowthConfig, useWallet } from "@/hooks/useGrowth";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; onSubmitted?: () => void };

const METHOD_LABEL: Record<string, string> = {
  mtn: "MTN Mobile Money",
  airtel: "Airtel Money",
  binance: "Binance",
};

const WithdrawSheet = ({ open, onOpenChange, onSubmitted }: Props) => {
  const { user, profile } = useAuth();
  const config = useGrowthConfig();
  const { wallet, refresh } = useWallet();
  const [points, setPoints] = useState("");
  const [method, setMethod] = useState<string>("");
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const country = (profile?.country_code || profile?.country || "").toUpperCase();
  const isRwanda = country === "RW" || country === "RWANDA";
  const availableMethods: string[] = isRwanda
    ? (config["payout.rwanda_methods"] || ["mtn", "airtel", "binance"])
    : (config["payout.global_methods"] || ["binance"]);
  const rate = Number(config["reward.conversion_rate_usd_per_100"] ?? 0.5);
  const min = Number(config["reward.min_withdrawal"] ?? 500);
  const pts = Number(points) || 0;
  const usd = useMemo(() => ((pts / 100) * rate).toFixed(2), [pts, rate]);
  const identityOk = profile?.identity_verified;
  const phoneOk = !!profile?.phone_number;
  const canSubmit = pts >= min && pts <= (wallet?.balance || 0) && method && identityOk && phoneOk;

  useEffect(() => { setPayload({}); }, [method]);

  const submit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // basic payload validation
      if (method === "binance") {
        if (!payload.binance_uid && !payload.pay_id) throw new Error("Enter Binance UID or Pay ID");
      } else {
        if (!payload.phone || !payload.names || !payload.network) throw new Error("Fill all fields");
        if (payload.confirm !== payload.phone) throw new Error("Phone confirmation does not match");
      }
      const { data, error } = await supabase.rpc("withdrawal_create", {
        _points: pts, _method: method, _payload: payload as any,
      } as any);
      if (error) throw error;
      toast.success("Withdrawal submitted for review");
      onOpenChange(false); setPoints(""); setMethod(""); setPayload({});
      await refresh(); onSubmitted?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit");
    } finally { setLoading(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        <SheetHeader><SheetTitle>Withdraw points</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          {!identityOk && <Alert><AlertDescription>Verify your identity before withdrawing.</AlertDescription></Alert>}
          {!phoneOk && <Alert><AlertDescription>Add a verified phone number before withdrawing.</AlertDescription></Alert>}

          <div>
            <Label>Points</Label>
            <Input inputMode="numeric" value={points} onChange={e => setPoints(e.target.value.replace(/\D/g, ""))} placeholder={`Min ${min}`} />
            <div className="text-xs text-muted-foreground mt-1">
              Available {wallet?.balance || 0} pts · Rate 100 pts = ${rate.toFixed(2)}
            </div>
            {pts > 0 && (
              <div className="mt-2 text-sm font-medium">You will receive <span className="text-primary text-lg">${usd}</span></div>
            )}
          </div>

          <div>
            <Label>Payment method</Label>
            <RadioGroup value={method} onValueChange={setMethod} className="mt-2">
              {availableMethods.map(m => (
                <label key={m} className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer has-[:checked]:border-primary">
                  <RadioGroupItem value={m} />
                  <span className="text-sm">{METHOD_LABEL[m] || m}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {method === "binance" && (
            <div className="space-y-2">
              <Label>Binance UID</Label>
              <Input value={payload.binance_uid || ""} onChange={e => setPayload({ ...payload, binance_uid: e.target.value })} placeholder="e.g. 123456789" />
              <Label>or Binance Pay ID</Label>
              <Input value={payload.pay_id || ""} onChange={e => setPayload({ ...payload, pay_id: e.target.value })} />
            </div>
          )}

          {(method === "mtn" || method === "airtel") && (
            <div className="space-y-2">
              <Label>Phone number</Label>
              <Input value={payload.phone || ""} onChange={e => setPayload({ ...payload, phone: e.target.value })} placeholder="+250..." />
              <Label>Confirm phone number</Label>
              <Input value={payload.confirm || ""} onChange={e => setPayload({ ...payload, confirm: e.target.value })} />
              <Label>Registered names</Label>
              <Input value={payload.names || ""} onChange={e => setPayload({ ...payload, names: e.target.value })} />
              <Label>Network</Label>
              <Input value={payload.network || (method === "mtn" ? "MTN" : "Airtel")} onChange={e => setPayload({ ...payload, network: e.target.value })} />
            </div>
          )}

          <Button className="w-full" size="lg" disabled={!canSubmit || loading} onClick={submit}>
            {loading ? "Submitting..." : "Submit withdrawal"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WithdrawSheet;
