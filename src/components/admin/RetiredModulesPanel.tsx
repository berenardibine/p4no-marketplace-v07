import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRetiredTableStats, subscribeRetiredTables } from "@/lib/apiFirewall";

/**
 * Diagnostic panel for retired modules (currently Product Likes).
 * Event-driven only: no polling, no database reads. Expected value is 0.
 */
const RetiredModulesPanel = () => {
  const [stats, setStats] = useState(() => getRetiredTableStats());

  useEffect(() => subscribeRetiredTables(() => setStats(getRetiredTableStats())), []);

  const count = stats.productLikesRequests;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          Retired module diagnostics
          <Badge variant={count === 0 ? "secondary" : "destructive"}>
            {count === 0 ? "CLEAN" : "LEAKING"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Product Likes Requests</p>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-[11px] text-muted-foreground">
            Expected 0 — reads, writes and background sync are all disabled and blocked at the
            network layer. `product_likes` rows are retained but never queried.
          </p>
        </div>

        {stats.recent.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium">Forensic log (last hits)</p>
            <div className="max-h-48 overflow-auto text-[11px] font-mono space-y-1">
              {stats.recent.map((h, i) => (
                <div key={i} className="border rounded p-1.5">
                  <div>
                    {new Date(h.at).toLocaleTimeString()} · {h.method} · {h.table} · {h.route}
                  </div>
                  <div className="text-muted-foreground break-all">{h.stack}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RetiredModulesPanel;
