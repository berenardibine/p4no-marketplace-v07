import FileOptimizationDashboard from "@/components/admin/FileOptimizationDashboard";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Shield, Loader2 } from "lucide-react";

const AdminFileOptimization = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <Shield className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">Admin privileges required</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-lg">File Optimization</h1>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl">
            <Home className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <FileOptimizationDashboard />
      </div>
    </div>
  );
};

export default AdminFileOptimization;
