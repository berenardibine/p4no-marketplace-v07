import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SellerTasksTab from "@/components/seller/SellerTasksTab";

const TasksPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Tasks</h1>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-4">
        <SellerTasksTab />
      </div>
    </div>
  );
};

export default TasksPage;
