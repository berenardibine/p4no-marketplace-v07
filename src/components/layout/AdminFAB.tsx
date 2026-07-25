import { useNavigate } from 'react-router-dom';
import { Shield, Sparkles } from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin';
import { cn } from '@/lib/utils';

const AdminFAB = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdmin();

  if (loading || !isAdmin) return null;

  return (
    <button
      onClick={() => navigate('/admin')}
      className={cn(
        "fixed bottom-20 right-4 z-40",
        "w-14 h-14 rounded-full",
        "bg-gradient-to-br from-purple-600 via-violet-500 to-indigo-600",
        "shadow-lg shadow-purple-500/40",
        "flex items-center justify-center",
        "hover:scale-110 active:scale-95 transition-all duration-300",
        "animate-pulse"
      )}
      aria-label="Admin Dashboard"
    >
      <Shield className="h-6 w-6 text-white" />
      <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400 animate-bounce" />
    </button>
  );
};

export default AdminFAB;
