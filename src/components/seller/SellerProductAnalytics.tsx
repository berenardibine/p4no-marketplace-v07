import { Card, CardContent } from "@/components/ui/card";
import { useWeeklyStats } from "@/hooks/useWeeklyStats";
import { formatNumber } from "@/lib/formatNumber";
import { Eye, MousePointerClick, TrendingUp, TrendingDown, Minus, Lightbulb, Calendar, BarChart3, Loader2 } from "lucide-react";

const GrowthBadge = ({ value }: { value: number }) => {
  if (value > 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
      <TrendingUp className="h-3 w-3" /> +{value}%
    </span>
  );
  if (value < 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400">
      <TrendingDown className="h-3 w-3" /> {value}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      <Minus className="h-3 w-3" /> 0%
    </span>
  );
};

const SellerProductAnalytics = () => {
  const { report, previousReport, loading, error } = useWeeklyStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-destructive/10 border-destructive/20">
        <CardContent className="p-6 text-center">
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No Report Yet</h3>
            <p className="text-sm text-muted-foreground">
              Your first weekly performance report will be available at the end of this week.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if current week is finished
  const today = new Date();
  const weekEnd = new Date(report.weekEnd + "T23:59:59");
  const isCurrentWeekDone = today > weekEnd;

  return (
    <div className="space-y-4">
      {/* Week info banner */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-xl">
        <Calendar className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {isCurrentWeekDone ? "Latest Report" : "Current Week (in progress)"}
          {" · "}
          {new Date(report.weekStart).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          {" – "}
          {new Date(report.weekEnd).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {!isCurrentWeekDone && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          📌 Full report will be available at the end of the week. Stats shown are partial.
        </div>
      )}

      {/* Weekly Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Weekly Views</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(report.weeklyViews)}</p>
            <GrowthBadge value={report.growthViewsPct} />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MousePointerClick className="h-4 w-4 text-secondary-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Weekly Impressions</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(report.weeklyImpressions)}</p>
            <GrowthBadge value={report.growthImpressionsPct} />
          </CardContent>
        </Card>
      </div>

      {/* Lifetime Stats */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Lifetime Performance
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Views</p>
              <p className="text-xl font-bold">{formatNumber(report.lifetimeViews)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Impressions</p>
              <p className="text-xl font-bold">{formatNumber(report.lifetimeImpressions)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Suggestion */}
      {report.suggestion && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Lightbulb className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Smart Tip</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">{report.suggestion}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous Week Comparison */}
      {previousReport && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Previous Week</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Views</p>
                <p className="font-semibold">{formatNumber(previousReport.weeklyViews)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impressions</p>
                <p className="font-semibold">{formatNumber(previousReport.weeklyImpressions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SellerProductAnalytics;
