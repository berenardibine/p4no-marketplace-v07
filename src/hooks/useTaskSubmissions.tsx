import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TaskSubmission {
  id: string;
  user_id: string;
  task_id: string;
  status: string;
  proof_text: string | null;
  proof_image: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
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
  evidence_type: string | null;
  external_link: string | null;
  difficulty: string | null;
  reward_type: string | null;
  text_hint: string | null;
}

export const useTaskSubmissions = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<RewardTask[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
    if (user) fetchSubmissions();
  }, [user]);

  const fetchTasks = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('reward_tasks')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setTasks(data || []);
    setLoading(false);
  };

  const fetchSubmissions = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('task_submissions')
      .select('*')
      .eq('user_id', user.id);
    setSubmissions(data || []);
  };

  const getSubmission = (taskId: string) => {
    return submissions.find(s => s.task_id === taskId);
  };

  const submitTask = async (taskId: string, proofText?: string, proofImage?: string) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from('task_submissions')
      .insert({
        user_id: user.id,
        task_id: taskId,
        status: 'pending',
        proof_text: proofText || null,
        proof_image: proofImage || null,
      });
    if (error) throw error;
    await fetchSubmissions();
  };

  return { tasks, submissions, loading, getSubmission, submitTask, refetch: () => { fetchTasks(); fetchSubmissions(); } };
};

// Admin hook for managing all submissions
export const useAdminTaskSubmissions = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [tasks, setTasks] = useState<RewardTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [subsRes, tasksRes] = await Promise.all([
      (supabase as any).from('task_submissions').select('*, profiles:task_submissions_user_id_profiles_fkey(full_name, email, profile_image)').order('created_at', { ascending: false }),
      (supabase as any).from('reward_tasks').select('*').order('created_at', { ascending: false }),
    ]);
    setSubmissions(subsRes.data || []);
    setTasks(tasksRes.data || []);
    setLoading(false);
  };

  const reviewSubmission = async (submissionId: string, status: 'approved' | 'rejected', adminNotes: string, userId: string, taskId: string) => {
    // Update submission
    await (supabase as any)
      .from('task_submissions')
      .update({
        status,
        admin_notes: adminNotes,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (status === 'approved') {
      // Find the task to get reward amount
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        // Add reward transaction
        await (supabase as any)
          .from('reward_transactions')
          .insert({
            user_id: userId,
            amount: task.reward_points,
            transaction_type: 'task_reward',
            task_id: taskId,
            submission_id: submissionId,
            description: `Reward for completing: ${task.title}`,
          });

        // Update user_rewards points
        const { data: existing } = await supabase
          .from('user_rewards')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('user_rewards')
            .update({ 
              points: (existing.points || 0) + task.reward_points,
              coins: (existing.coins || 0) + task.reward_coins,
            })
            .eq('user_id', userId);
        }

        // Add points to wallet
        const { data: wallet } = await (supabase as any)
          .from('wallets')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (wallet) {
          await (supabase as any)
            .from('wallets')
            .update({ balance: wallet.balance + task.reward_points, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        } else {
          await (supabase as any)
            .from('wallets')
            .insert({ user_id: userId, balance: task.reward_points });
        }

        // Log wallet transaction
        await (supabase as any)
          .from('wallet_transactions')
          .insert({
            user_id: userId,
            amount: task.reward_points,
            type: 'earn',
            description: `Task reward: ${task.title}`,
          });
      }
    }

    // Send notification
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: status === 'approved' ? 'Task Approved! 🎉' : 'Task Rejected',
        message: status === 'approved'
          ? `Your task submission was approved! ${tasks.find(t => t.id === taskId)?.reward_points || 0} points added to your wallet.`
          : `Your task submission was rejected. Reason: ${adminNotes || 'No reason provided.'}`,
        type: status === 'approved' ? 'reward' : 'warning',
      });

    await fetchAll();
  };

  const createTask = async (task: Partial<RewardTask>) => {
    const { error } = await (supabase as any)
      .from('reward_tasks')
      .insert(task);
    if (error) throw error;
    await fetchAll();
  };

  const updateTask = async (taskId: string, updates: Partial<RewardTask>) => {
    const { error } = await (supabase as any)
      .from('reward_tasks')
      .update(updates)
      .eq('id', taskId);
    if (error) throw error;
    await fetchAll();
  };

  const deleteTask = async (taskId: string) => {
    await (supabase as any)
      .from('reward_tasks')
      .delete()
      .eq('id', taskId);
    await fetchAll();
  };

  return { submissions, tasks, loading, reviewSubmission, createTask, updateTask, deleteTask, refetch: fetchAll };
};
