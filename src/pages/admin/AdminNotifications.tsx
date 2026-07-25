import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import NotificationManagement from "@/components/admin/NotificationManagement";
import NotificationAnalytics from "@/components/admin/NotificationAnalytics";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const AdminNotifications = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();

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
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg">Notifications</h1>
        </div>
      </div>

      <div className="p-4">
        <Tabs defaultValue="manage">
          <TabsList className="mb-4">
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="manage">
            <NotificationManagement />
          </TabsContent>
          <TabsContent value="analytics">
            <NotificationAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminNotifications;
