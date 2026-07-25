import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SellerDashboard from "./SellerDashboard";

const MyShopPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (profile?.user_type !== 'seller') {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-50 bg-gradient-to-r from-primary to-orange-500 pt-safe">
          <div className="flex items-center gap-3 p-4">
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <h1 className="font-semibold text-lg text-white">My Shop</h1>
          </div>
        </div>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">You need to be a seller to access this page.</p>
        </div>
      </div>
    );
  }

  return <SellerDashboard />;
};

export default MyShopPage;
