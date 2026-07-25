import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const AdminRewardSettings = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Record<string, string>>({});
  const [descs, setDescs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("growth_config").select("key,value,description").order("key").then(({ data }) => {
      const map: Record<string, string> = {}; const d: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = JSON.stringify(r.value, null, 2); d[r.key] = r.description || ""; });
      setRows(map); setDescs(d); setLoading(false);
    });
  }, []);

  const save = async (key: string) => {
    try {
      const value = JSON.parse(rows[key]);
      const { error } = await supabase.from("growth_config").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
      if (error) throw error;
      toast.success(`Saved ${key}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-lg font-semibold">Reward Settings</h1>
        </div>
      </div>
      <div className="max-w-4xl mx-auto p-4 space-y-3">
        {loading && <p className="text-sm text-center text-muted-foreground py-8">Loading…</p>}
        {Object.keys(rows).map(key => {
          const val = rows[key];
          const isSimple = /^[\d.]+$/.test(val);
          return (
            <Card key={key} className="p-4 space-y-2">
              <div>
                <Label className="font-mono text-sm">{key}</Label>
                {descs[key] && <p className="text-xs text-muted-foreground">{descs[key]}</p>}
              </div>
              {isSimple
                ? <Input value={val} onChange={e => setRows({ ...rows, [key]: e.target.value })} />
                : <Textarea rows={Math.min(12, val.split("\n").length + 1)} className="font-mono text-xs" value={val} onChange={e => setRows({ ...rows, [key]: e.target.value })} />}
              <Button size="sm" onClick={() => save(key)}><Save className="w-4 h-4 mr-1" />Save</Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminRewardSettings;
