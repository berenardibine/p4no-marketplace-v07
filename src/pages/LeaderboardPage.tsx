import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trophy, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Row = { user_id: string; rank: number; value: number; full_name?: string; profile_image?: string };

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("all_time");
  const [category, setCategory] = useState("referrers");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("leaderboard_snapshots")
        .select("user_id, rank, value")
        .eq("period", period).eq("category", category)
        .order("rank", { ascending: true }).limit(100);
      let list = (data as any) || [];
      if (list.length === 0 && category === "referrers") {
        // fallback: compute referrers live from referrals
        const { data: refs } = await supabase.from("referrals").select("referrer_id").eq("status", "verified");
        const counts = new Map<string, number>();
        (refs || []).forEach((r: any) => counts.set(r.referrer_id, (counts.get(r.referrer_id) || 0) + 1));
        list = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100)
          .map(([user_id, value], i) => ({ user_id, rank: i + 1, value }));
      }
      if (list.length) {
        const ids = list.map((r: any) => r.user_id);
        const { data: profs } = await supabase.from("profiles").select("id, full_name, profile_image").in("id", ids);
        const map = new Map((profs || []).map((p: any) => [p.id, p]));
        list = list.map((r: any) => ({ ...r, ...map.get(r.user_id) }));
      }
      setRows(list); setLoading(false);
    })();
  }, [period, category]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-lg font-semibold">Leaderboard</h1>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="w-full">
            <TabsTrigger value="weekly" className="flex-1">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="flex-1">Monthly</TabsTrigger>
            <TabsTrigger value="all_time" className="flex-1">All time</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="w-full overflow-x-auto">
            {["referrers", "sellers", "buyers", "earners", "ambassadors"].map(c => (
              <TabsTrigger key={c} value={c} className="capitalize flex-1">{c}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={category} className="space-y-2 mt-3">
            {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
            {!loading && rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No rankings yet</p>}
            {rows.map(r => (
              <Card key={r.user_id} className="p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${r.rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {r.rank <= 3 ? <Medal className="w-4 h-4" /> : r.rank}
                </div>
                {r.profile_image
                  ? <img src={r.profile_image} alt="" className="w-8 h-8 rounded-full object-cover" />
                  : <div className="w-8 h-8 rounded-full bg-muted" />}
                <div className="flex-1 text-sm truncate">{r.full_name || "User"}</div>
                <div className="font-bold flex items-center gap-1"><Trophy className="w-3 h-3" /> {r.value}</div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LeaderboardPage;
