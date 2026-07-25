import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import ShopManagement from "@/components/admin/ShopManagement";

const AdminShops = () => {
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
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate('/admin')}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-lg">Shop Management</h1>
        </div>
      </div>

      <div className="p-4">
        <ShopManagement />
      </div>
    </div>
  );
};

export default AdminShops;
