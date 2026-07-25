import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserReward {
  id: string;
  user_id: string;
  coins: number;
  points: number;
  streak_days: number;
  last_login_date: string | null;
  level: number;
  badge: string | null;
}

export interface RewardTask {
  id: string;
  title: string;
  description: string;
  reward_points: number;
  reward_coins: number;
  task_type: string;
  requirement_count: number;
  icon: string | null;
  color: string | null;
  expires_at: string | null;
  is_active: boolean;
  category: string | null;
  requires_evidence: boolean;
}

export interface TaskProgress {
  id: string;
  user_id: string;
  task_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
}

export const useRewards = () => {
  const { user } = useAuth();
  const [userReward, setUserReward] = useState<UserReward | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserReward();
    } else {
      setUserReward(null);
      setLoading(false);
    }
  }, [user]);

  const fetchUserReward = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_rewards')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUserReward(data as UserReward);
      } else {
        // Create default reward record
        const { data: newReward, error: insertError } = await supabase
          .from('user_rewards')
          .insert({ user_id: user.id })
          .select()
          .single();
        
        if (!insertError && newReward) {
          setUserReward(newReward as UserReward);
        }
      }
    } catch (err) {
      console.error('Error fetching rewards:', err);
    } finally {
      setLoading(false);
    }
  };

  return { userReward, loading, refetch: fetchUserReward };
};

export const useTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<RewardTask[]>([]);
  const [progress, setProgress] = useState<TaskProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
    if (user) {
      fetchProgress();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reward_tasks')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data as RewardTask[] || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('user_task_progress')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setProgress(data as TaskProgress[] || []);
    } catch (err) {
      console.error('Error fetching progress:', err);
    }
  };

  const getTaskProgress = (taskId: string) => {
    return progress.find(p => p.task_id === taskId);
  };

  const joinTask = async (taskId: string) => {
    if (!user) return;

    try {
      const { error } = await (supabase as any)
        .from('user_task_progress')
        .insert({
          user_id: user.id,
          task_id: taskId,
          progress: 0,
          completed: false
        });

      if (error) throw error;
      await fetchProgress();
    } catch (err) {
      console.error('Error joining task:', err);
    }
  };

  return { tasks, progress, loading, getTaskProgress, joinTask, refetch: fetchTasks };
};

export const useLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_rewards')
        .select(`
          *,
          profile:profiles!user_rewards_user_id_fkey(full_name, profile_image)
        `)
        .order('points', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  return { leaderboard, loading };
};
