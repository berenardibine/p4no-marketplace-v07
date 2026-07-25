import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Globe } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import GlobalAnalyticsDashboard from "@/components/admin/GlobalAnalyticsDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [activeTab, setActiveTab] = useState('global');

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg">Analytics</h1>
        </div>
      </div>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="global" className="gap-2 rounded-xl">
              <Globe className="h-4 w-4" />
              Global Analytics
            </TabsTrigger>
            <TabsTrigger value="platform" className="gap-2 rounded-xl">
              <BarChart3 className="h-4 w-4" />
              Platform Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global">
            <GlobalAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="platform">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminAnalytics;
