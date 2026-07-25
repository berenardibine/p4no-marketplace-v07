import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type TargetType = 'product_card' | 'product_detail' | 'profile' | 'banner' | 'thumbnail';

export interface OptimizationResult {
  optimizedUrl: string;
  originalUrl: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  wasEnhanced: boolean;
  wasResized: boolean;
  targetDimensions: { width: number; height: number };
  format: string;
  qualityScore: number;
  error?: string;
}

export interface OptimizationStats {
  totalFilesProcessed: number;
  totalSpaceSaved: number;
  averageCompression: number;
  filesEnhanced: number;
}

export function useFileOptimization() {
  const { toast } = useToast();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);

  const optimizeFile = useCallback(async (
    imageUrl: string,
    targetType: TargetType = 'product_card',
    enhanceQuality: boolean = true
  ): Promise<OptimizationResult | null> => {
    setIsOptimizing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await fetch(
        `https://tbykrulfzhhkmtgjhvjh.supabase.co/functions/v1/optimize-file`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRieWtydWxmemhoa210Z2podmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjgxNTksImV4cCI6MjA4MDQ0NDE1OX0.Bm5bMN6QGgXeF2EOvmF7nmNBksmrPCLTkcXy-bXWiV0'}`
          },
          body: JSON.stringify({
            imageUrl,
            userId: user?.id,
            targetType,
            enhanceQuality
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Optimization failed');
      }

      const result: OptimizationResult = await response.json();
      
      if (result.compressionRatio > 0) {
        toast({
          title: "✨ Image Optimized",
          description: `Reduced by ${result.compressionRatio}%${result.wasEnhanced ? ' + Enhanced quality' : ''}`
        });
      }

      return result;
    } catch (error) {
      console.error('File optimization error:', error);
      toast({
        title: "Optimization failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, [toast]);

  const optimizeMultipleFiles = useCallback(async (
    imageUrls: string[],
    targetType: TargetType = 'product_card',
    enhanceQuality: boolean = true
  ): Promise<OptimizationResult[]> => {
    setIsOptimizing(true);
    setProgress(0);
    const results: OptimizationResult[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const result = await optimizeFile(imageUrls[i], targetType, enhanceQuality);
      if (result) {
        results.push(result);
      }
      setProgress(Math.round(((i + 1) / imageUrls.length) * 100));
    }

    setIsOptimizing(false);
    setProgress(0);
    
    const totalSaved = results.reduce((sum, r) => sum + (r.originalSize - r.optimizedSize), 0);
    const avgCompression = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length)
      : 0;

    if (results.length > 0) {
      toast({
        title: "🎉 Batch Optimization Complete",
        description: `${results.length} files optimized, saved ${formatBytes(totalSaved)} (${avgCompression}% avg)`
      });
    }

    return results;
  }, [optimizeFile, toast]);

  const runBatchOptimization = useCallback(async (
    limit: number = 50,
    minSizeBytes: number = 512000,
    dryRun: boolean = false
  ) => {
    setIsOptimizing(true);
    
    try {
      const response = await fetch(
        `https://tbykrulfzhhkmtgjhvjh.supabase.co/functions/v1/batch-optimize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRieWtydWxmemhoa210Z2podmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NjgxNTksImV4cCI6MjA4MDQ0NDE1OX0.Bm5bMN6QGgXeF2EOvmF7nmNBksmrPCLTkcXy-bXWiV0'}`
          },
          body: JSON.stringify({ limit, minSizeBytes, dryRun })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Batch optimization failed');
      }

      const result = await response.json();
      
      if (!dryRun) {
        toast({
          title: "🚀 Batch Optimization Complete",
          description: `Processed ${result.processed} files, saved ${result.spaceSaved}`
        });
      }

      return result;
    } catch (error) {
      console.error('Batch optimization error:', error);
      toast({
        title: "Batch optimization failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, [toast]);

  const getOptimizationStats = useCallback(async (): Promise<OptimizationStats | null> => {
    try {
      const { data, error } = await supabase
        .from('file_optimization_logs')
        .select('original_size, optimized_size, compression_ratio, was_enhanced');

      if (error) throw error;

      const stats: OptimizationStats = {
        totalFilesProcessed: data?.length || 0,
        totalSpaceSaved: data?.reduce((sum, r) => sum + (r.original_size - r.optimized_size), 0) || 0,
        averageCompression: data?.length 
          ? Math.round(data.reduce((sum, r) => sum + r.compression_ratio, 0) / data.length)
          : 0,
        filesEnhanced: data?.filter(r => r.was_enhanced).length || 0
      };

      return stats;
    } catch (error) {
      console.error('Failed to fetch optimization stats:', error);
      return null;
    }
  }, []);

  return {
    optimizeFile,
    optimizeMultipleFiles,
    runBatchOptimization,
    getOptimizationStats,
    isOptimizing,
    progress
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
