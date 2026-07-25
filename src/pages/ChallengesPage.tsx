import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Trophy, Target, Star, Gift, Clock, 
  CheckCircle, Zap, TrendingUp, Users 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTasks, useRewards } from "@/hooks/useRewards";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const ChallengesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tasks, loading, getTaskProgress, joinTask } = useTasks();
  const { userReward } = useRewards();
  const { toast } = useToast();

  const getIconComponent = (iconName: string | null) => {
    switch (iconName) {
      case 'trophy': return Trophy;
      case 'zap': return Zap;
      case 'target': return Target;
      case 'star': return Star;
      case 'gift': return Gift;
      case 'users': return Users;
      default: return Trophy;
    }
  };

  const handleJoinTask = async (taskId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    await joinTask(taskId);
    toast({
      title: "Challenge joined!",
      description: "Good luck completing this challenge!",
    });
  };

  const activeTasks = tasks.filter(t => {
    const progress = getTaskProgress(t.id);
    return !progress?.completed;
  });

  const completedTasks = tasks.filter(t => {
    const progress = getTaskProgress(t.id);
    return progress?.completed;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-primary pt-safe pb-8">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg text-white">Smart Challenges</h1>
        </div>

        {/* Stats */}
        <div className="px-4 mt-4">
          <div className="flex items-center gap-4 bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="w-16 h-16 rounded-xl bg-white/30 flex items-center justify-center">
              <Trophy className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white/80 text-sm">Total Points Earned</p>
              <p className="text-3xl font-bold text-white">{userReward?.points || 0}</p>
            </div>
            <div className="text-right">
              <Badge className="bg-white text-primary">Level {userReward?.level || 1}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-4 -mt-4 grid grid-cols-3 gap-2">
        <div className="bg-card rounded-xl p-3 text-center border shadow-sm">
          <Zap className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="font-bold">{userReward?.streak_days || 0}</p>
          <p className="text-xs text-muted-foreground">Streak</p>
        </div>
        <div className="bg-card rounded-xl p-3 text-center border shadow-sm">
          <Gift className="h-5 w-5 text-purple-500 mx-auto mb-1" />
          <p className="font-bold">{userReward?.coins || 0}</p>
          <p className="text-xs text-muted-foreground">Coins</p>
        </div>
        <div className="bg-card rounded-xl p-3 text-center border shadow-sm">
          <Target className="h-5 w-5 text-green-500 mx-auto mb-1" />
          <p className="font-bold">{completedTasks.length}</p>
          <p className="text-xs text-muted-foreground">Done</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="px-4 mt-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active ({activeTasks.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3 mt-4">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))
          ) : activeTasks.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No active challenges</h3>
              <p className="text-sm text-muted-foreground">Check back soon for new challenges!</p>
            </div>
          ) : (
            activeTasks.map((task) => {
              const progress = getTaskProgress(task.id);
              const Icon = getIconComponent(task.icon);
              const progressPercent = progress 
                ? (progress.progress / (task.requirement_count || 1)) * 100 
                : 0;
              const hasJoined = !!progress;

              return (
                <div key={task.id} className="bg-card rounded-2xl p-4 border shadow-sm">
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: task.color || '#f97316' }}
                    >
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{task.title}</h3>
                        <div className="flex items-center gap-1 text-amber-500">
                          <Zap className="h-4 w-4" />
                          <span className="font-bold text-sm">+{task.reward_points}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      
                      {hasJoined && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{progress?.progress || 0}/{task.requirement_count || 1}</span>
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          {task.expires_at && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(task.expires_at), 'MMM d')}
                            </span>
                          )}
                          {task.category && (
                            <Badge variant="outline" className="text-xs">{task.category}</Badge>
                          )}
                        </div>
                        {!hasJoined && (
                          <Button size="sm" onClick={() => handleJoinTask(task.id)}>
                            Join
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3 mt-4">
          {completedTasks.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No completed challenges</h3>
              <p className="text-sm text-muted-foreground">Complete challenges to earn rewards!</p>
            </div>
          ) : (
            completedTasks.map((task) => {
              const Icon = getIconComponent(task.icon);
              return (
                <div key={task.id} className="bg-green-50 rounded-2xl p-4 border border-green-200">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-green-500 flex items-center justify-center">
                      <CheckCircle className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{task.title}</h3>
                      <p className="text-sm text-green-600">+{task.reward_points} points earned!</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChallengesPage;