import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  HardDrive, Zap, Image, TrendingDown, RefreshCw, 
  CheckCircle, AlertCircle, Loader2, Sparkles, FileImage,
  Clock, Trophy, Timer
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFileOptimization } from "@/hooks/useFileOptimization";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface OptimizationLog {
  id: string;
  original_url: string;
  optimized_url: string;
  original_size: number;
  optimized_size: number;
  compression_ratio: number;
  was_enhanced: boolean;
  target_type: string;
  created_at: string;
}

interface BatchJob {
  id: string;
  files_processed: number;
  files_failed: number;
  files_skipped: number;
  space_saved: number;
  compression_ratio: number;
  status: string;
  created_at: string;
}

interface ProductFile {
  productId: string;
  productTitle: string;
  imageUrl: string;
  isOptimized: boolean;
  estimatedSize: string;
}

const FileOptimizationDashboard = () => {
  const { toast } = useToast();
  const { optimizeFile, runBatchOptimization, getOptimizationStats, isOptimizing, progress } = useFileOptimization();
  
  const [stats, setStats] = useState({
    totalFiles: 0,
    spaceSaved: 0,
    avgCompression: 0,
    filesEnhanced: 0,
    unoptimizedProducts: 0,
    optimizedProducts: 0,
    largestFileSaved: 0,
    lastRunTime: '',
  });
  const [recentLogs, setRecentLogs] = useState<OptimizationLog[]>([]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [productFiles, setProductFiles] = useState<ProductFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizingSingle, setOptimizingSingle] = useState<string | null>(null);
  const [runningAutoOptimize, setRunningAutoOptimize] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'logs'>('overview');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const statsResult = await getOptimizationStats();
      
      // Fetch optimization logs to build a set of already-optimized URLs
      const { data: optimizationLogs } = await supabase
        .from('file_optimization_logs')
        .select('original_url, optimized_url');
      
      const optimizedOriginalUrls = new Set(
        (optimizationLogs || []).map(log => log.original_url)
      );
      const optimizedResultUrls = new Set(
        (optimizationLogs || []).map(log => log.optimized_url)
      );
      
      // Fetch all products with images
      const { data: products } = await supabase
        .from('products')
        .select('id, title, images')
        .not('images', 'is', null);
      
      const allFiles: ProductFile[] = [];
      let optimizedCount = 0;
      let unoptimizedCount = 0;
      
      (products || []).forEach(p => {
        const images = p.images as string[] || [];
        images.forEach(img => {
          // Check if the image URL is in the optimization logs (either as original or optimized)
          const isOpt = optimizedOriginalUrls.has(img) || optimizedResultUrls.has(img);
          if (isOpt) optimizedCount++;
          else unoptimizedCount++;
          
          allFiles.push({
            productId: p.id,
            productTitle: p.title,
            imageUrl: img,
            isOptimized: isOpt,
            estimatedSize: isOpt ? '< 500KB' : '> 500KB'
          });
        });
      });
      
      setProductFiles(allFiles);

      if (statsResult) {
        // Find largest single file saving
        const { data: largestLog } = await supabase
          .from('file_optimization_logs')
          .select('original_size, optimized_size')
          .order('original_size', { ascending: false })
          .limit(1);

        const largestSaved = largestLog?.[0] 
          ? (largestLog[0].original_size - largestLog[0].optimized_size) 
          : 0;

        // Find last batch run time
        const { data: lastJob } = await supabase
          .from('batch_optimization_jobs')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1);

        setStats({
          totalFiles: statsResult.totalFilesProcessed,
          spaceSaved: statsResult.totalSpaceSaved,
          avgCompression: statsResult.averageCompression,
          filesEnhanced: statsResult.filesEnhanced,
          unoptimizedProducts: unoptimizedCount,
          optimizedProducts: optimizedCount,
          largestFileSaved: largestSaved,
          lastRunTime: lastJob?.[0]?.created_at || '',
        });
      } else {
        setStats(prev => ({ 
          ...prev, 
          unoptimizedProducts: unoptimizedCount,
          optimizedProducts: optimizedCount
        }));
      }

      // Fetch recent logs
      const { data: logs } = await supabase
        .from('file_optimization_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (logs) setRecentLogs(logs);

      // Fetch batch jobs
      const { data: jobs } = await supabase
        .from('batch_optimization_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (jobs) setBatchJobs(jobs);
    } catch (error) {
      console.error('Failed to fetch optimization data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOptimizeSingle = async (file: ProductFile) => {
    setOptimizingSingle(file.imageUrl);
    try {
      const result = await optimizeFile(file.imageUrl, 'product_card', true);
      
      if (result?.optimizedUrl) {
        // Update the product's images array in database
        const { data: product, error: fetchErr } = await supabase
          .from('products')
          .select('images')
          .eq('id', file.productId)
          .single();
        
        if (fetchErr) {
          console.error('Failed to fetch product:', fetchErr);
          throw fetchErr;
        }

        if (product) {
          const images = (product.images as string[]) || [];
          const updatedImages = images.map(img => 
            img === file.imageUrl ? result.optimizedUrl : img
          );
          
          const { error: updateErr } = await supabase
            .from('products')
            .update({ images: updatedImages })
            .eq('id', file.productId);
          
          if (updateErr) {
            console.error('Failed to update product images:', updateErr);
            toast({
              title: "Warning",
              description: "File optimized but failed to update product reference",
              variant: "destructive"
            });
          }
        }
        
        toast({
          title: "File Optimized",
          description: `Saved ${result.compressionRatio}% - ${formatBytes(result.originalSize - result.optimizedSize)}`,
        });
        
        // Refresh data to show updated status
        await fetchData();
      }
    } catch (error) {
      toast({
        title: "Optimization Failed",
        description: error instanceof Error ? error.message : "Could not optimize this file",
        variant: "destructive"
      });
    } finally {
      setOptimizingSingle(null);
    }
  };

  const handleRunAutoOptimize = async () => {
    setRunningAutoOptimize(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-optimize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({}),
        }
      );
      const result = await response.json();
      if (response.ok) {
        toast({
          title: "🚀 Auto-Optimization Complete",
          description: `Processed ${result.processed} files, ${result.remaining} remaining`,
        });
        fetchData();
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (err) {
      toast({
        title: "Auto-optimization failed",
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setRunningAutoOptimize(false);
    }
  };

  const handleOptimizeAll = async () => {
    const result = await runBatchOptimization(100, 100000, false);
    if (result) {
      toast({
        title: "Batch Optimization Complete",
        description: `Processed ${result.processed || 0} files`,
      });
      fetchData();
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileName = (url: string) => {
    return url.split('/').pop()?.slice(0, 30) || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            File Optimization System
          </h2>
          <p className="text-muted-foreground">
            Compress, optimize, and enhance all media files
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleRunAutoOptimize} disabled={runningAutoOptimize}>
            {runningAutoOptimize ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Timer className="h-4 w-4 mr-2" />
            )}
            Auto-Optimize
          </Button>
          <Button onClick={handleOptimizeAll} disabled={isOptimizing}>
            {isOptimizing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Optimize All
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {isOptimizing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Batch Optimization in Progress...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col items-center text-center">
              <div className="p-2 rounded-xl bg-primary/10 mb-2">
                <Image className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xl font-bold">{stats.totalFiles}</p>
              <p className="text-xs text-muted-foreground">Files Processed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col items-center text-center">
              <div className="p-2 rounded-xl bg-green-500/10 mb-2">
                <HardDrive className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-xl font-bold">{formatBytes(stats.spaceSaved)}</p>
              <p className="text-xs text-muted-foreground">Space Saved</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col items-center text-center">
              <div className="p-2 rounded-xl bg-blue-500/10 mb-2">
                <TrendingDown className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-xl font-bold">{stats.avgCompression}%</p>
              <p className="text-xs text-muted-foreground">Avg Compression</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col items-center text-center">
              <div className="p-2 rounded-xl bg-purple-500/10 mb-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
              <p className="text-xl font-bold">{stats.filesEnhanced}</p>
              <p className="text-xs text-muted-foreground">AI Enhanced</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col items-center text-center">
              <div className="p-2 rounded-xl bg-emerald-500/10 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-xl font-bold">{stats.optimizedProducts}</p>
              <p className="text-xs text-muted-foreground">Optimized</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col items-center text-center">
              <div className="p-2 rounded-xl bg-red-500/10 mb-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <p className="text-xl font-bold">{stats.unoptimizedProducts}</p>
              <p className="text-xs text-muted-foreground">Unoptimized</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Extra Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">{formatBytes(stats.largestFileSaved)}</p>
                <p className="text-xs text-muted-foreground">Largest File Compressed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">
                  {stats.lastRunTime ? formatDate(stats.lastRunTime) : 'Never'}
                </p>
                <p className="text-xs text-muted-foreground">Last Optimization Run</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">≤ 100KB</p>
                <p className="text-xs text-muted-foreground">Max File Size Target</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'files' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          All Files ({productFiles.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'logs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          Optimization Logs
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Batch Jobs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Batch Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {batchJobs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No batch jobs yet</p>
              ) : (
                <div className="space-y-3">
                  {batchJobs.slice(0, 5).map(job => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        {job.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{job.files_processed} files processed</p>
                          <p className="text-xs text-muted-foreground">{formatDate(job.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={job.compression_ratio > 50 ? "default" : "secondary"}>
                          {job.compression_ratio || 0}% saved
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatBytes(job.space_saved || 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unoptimized Files Quick View */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Unoptimized Files</span>
                <Badge variant="destructive">{stats.unoptimizedProducts}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {productFiles.filter(f => !f.isOptimized).length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">All files are optimized!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {productFiles.filter(f => !f.isOptimized).slice(0, 10).map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-red-500/5 rounded-lg">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                        <img src={file.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.productTitle}</p>
                        <p className="text-xs text-muted-foreground">{file.estimatedSize}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOptimizeSingle(file)}
                        disabled={optimizingSingle === file.imageUrl}
                      >
                        {optimizingSingle === file.imageUrl ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'files' && (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Est. Size</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productFiles.map((file, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted">
                        <img src={file.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">{file.productTitle}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{getFileName(file.imageUrl)}</TableCell>
                    <TableCell>
                      {file.isOptimized ? (
                        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Optimized
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Unoptimized
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{file.estimatedSize}</TableCell>
                    <TableCell>
                      {!file.isOptimized && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOptimizeSingle(file)}
                          disabled={optimizingSingle === file.imageUrl}
                        >
                          {optimizingSingle === file.imageUrl ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'logs' && (
        <Card>
          <CardContent className="pt-6">
            {recentLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No optimization logs yet</p>
            ) : (
              <div className="space-y-3">
                {recentLogs.map(log => (
                  <div key={log.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                      <img src={log.optimized_url} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getFileName(log.original_url)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(log.original_size)} → {formatBytes(log.optimized_size)}
                        {log.was_enhanced && ' • AI Enhanced'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={log.compression_ratio > 50 ? "default" : "secondary"}>
                        -{log.compression_ratio}%
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FileOptimizationDashboard;
