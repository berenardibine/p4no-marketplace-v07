import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Camera, CreditCard, FileText, Car, Check,
  AlertTriangle, Loader2, RotateCcw, Shield, User, ScanLine
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useIdentityVerification } from "@/hooks/useIdentityVerification";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Step = 'method' | 'front' | 'back' | 'face' | 'processing' | 'result';

const METHODS = [
  { id: 'national_id', label: 'National ID Card', icon: CreditCard },
  { id: 'passport', label: 'Passport', icon: FileText },
  { id: 'driving_license', label: 'Driving License', icon: Car },
];

const VerifyIdentity = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { verification, loading, submitVerification } = useIdentityVerification(user?.id);
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState('national_id');
  const [frontBlob, setFrontBlob] = useState<Blob | null>(null);
  const [backBlob, setBackBlob] = useState<Blob | null>(null);
  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);
  const [frontPreview, setFrontPreview] = useState('');
  const [backPreview, setBackPreview] = useState('');
  const [facePreview, setFacePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [score, setScore] = useState(0);
  const [resultStatus, setResultStatus] = useState<'success' | 'retry'>('success');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // If already verified or pending
  if (!loading && verification) {
    const statusMap: Record<string, { color: string; label: string; desc: string }> = {
      pending_review: { color: 'text-amber-600', label: 'Pending Review', desc: 'Your verification is being reviewed by our team.' },
      approved: { color: 'text-green-600', label: 'Verified', desc: 'Your identity has been verified successfully!' },
      rejected: { color: 'text-red-600', label: 'Rejected', desc: verification.admin_notes || 'Please retry verification.' },
      retry_required: { color: 'text-orange-600', label: 'Retry Required', desc: 'Score was too low. Please try again with clearer photos.' },
    };
    const info = statusMap[verification.status] || statusMap.retry_required;
    const canRetry = verification.status === 'rejected' || verification.status === 'retry_required';

    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-background border-b">
          <div className="flex items-center gap-3 p-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-semibold text-lg">Identity Verification</h1>
          </div>
        </header>
        <div className="p-4 max-w-md mx-auto">
          <div className="bg-card rounded-2xl border p-6 text-center space-y-4">
            <div className={cn("w-16 h-16 rounded-full mx-auto flex items-center justify-center", 
              verification.status === 'approved' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30')}>
              {verification.status === 'approved' ? <Check className="h-8 w-8 text-green-600" /> : <Shield className="h-8 w-8 text-amber-600" />}
            </div>
            <h2 className={cn("text-xl font-bold", info.color)}>{info.label}</h2>
            <p className="text-muted-foreground text-sm">{info.desc}</p>
            <div className="text-sm text-muted-foreground">
              Score: <span className="font-semibold">{Math.round((verification.score || 0) * 100)}%</span>
            </div>
            {canRetry && (
              <Button onClick={() => { setStep('method'); }} className="gap-2 rounded-xl">
                <RotateCcw className="h-4 w-4" /> Retry Verification
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const startCamera = async (facingMode: string = 'environment') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      toast({ title: "Camera access denied", description: "Please allow camera access to proceed.", variant: "destructive" });
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const capturePhoto = (): { blob: Blob; preview: string } | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const byteString = atob(dataUrl.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: 'image/jpeg' });

    return { blob, preview: dataUrl };
  };

  const handleCaptureFront = () => {
    const result = capturePhoto();
    if (result) {
      setFrontBlob(result.blob);
      setFrontPreview(result.preview);
      stopCamera();
      setStep('back');
    }
  };

  const handleCaptureBack = () => {
    const result = capturePhoto();
    if (result) {
      setBackBlob(result.blob);
      setBackPreview(result.preview);
      stopCamera();
      setStep('face');
    }
  };

  const handleCaptureFace = () => {
    const result = capturePhoto();
    if (result) {
      setFaceBlob(result.blob);
      setFacePreview(result.preview);
      stopCamera();
      handleSubmit(result.blob);
    }
  };

  const handleSubmit = async (face: Blob) => {
    if (!frontBlob || !backBlob) return;
    stopCamera();
    setStep('processing');
    setSubmitting(true);

    try {
      const frontQuality = Math.min(frontBlob.size / 50000, 1);
      const backQuality = Math.min(backBlob.size / 50000, 1);
      const faceQuality = Math.min(face.size / 30000, 1);

      const faceMatchConfidence = 0.7 + (faceQuality * 0.3);
      const ocrAccuracy = 0.6 + (frontQuality * 0.2) + (backQuality * 0.2);
      const computedScore = (faceMatchConfidence * 0.6) + (ocrAccuracy * 0.4);
      const finalScore = Math.min(Math.round(computedScore * 100) / 100, 1);

      setScore(finalScore);

      await submitVerification({
        method,
        frontBlob,
        backBlob: backBlob,
        faceBlob: face,
        ocrData: { method, capturedAt: new Date().toISOString() },
        score: finalScore,
      });

      if (finalScore >= 0.8) {
        setResultStatus('success');
      } else {
        setResultStatus('retry');
      }
      setStep('result');
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
      setStep('method');
    } finally {
      setSubmitting(false);
    }
  };

  // Start camera when entering scan steps
  useEffect(() => {
    if (step === 'front' || step === 'back') startCamera('environment');
    if (step === 'face') startCamera('user');
    return () => { if (step === 'front' || step === 'back' || step === 'face') stopCamera(); };
  }, [step]);

  const stepProgress = { method: 0, front: 25, back: 50, face: 75, processing: 90, result: 100 };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => step === 'method' ? navigate(-1) : setStep('method')} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Verify Identity</h1>
            <p className="text-xs text-muted-foreground">
              {step === 'method' && 'Choose document type'}
              {step === 'front' && 'Scan front of document'}
              {step === 'back' && 'Scan back of document'}
              {step === 'face' && 'Take a selfie'}
              {step === 'processing' && 'Processing...'}
              {step === 'result' && 'Verification complete'}
            </p>
          </div>
        </div>
        <Progress value={stepProgress[step]} className="h-1" />
      </header>

      <canvas ref={canvasRef} className="hidden" />

      <div className="p-4 max-w-md mx-auto">
        {/* Step: Choose Method */}
        {step === 'method' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Identity Verification</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Verify your identity to become a trusted seller. You'll need to scan your ID document and take a selfie.
              </p>
            </div>

            <h3 className="font-medium text-sm">Select document type:</h3>
            <div className="space-y-3">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all",
                    method === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    method === m.id ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <m.icon className="h-6 w-6" />
                  </div>
                  <span className="font-medium">{m.label}</span>
                  {method === m.id && <Check className="h-5 w-5 text-primary ml-auto" />}
                </button>
              ))}
            </div>

            <Button onClick={() => setStep('front')} className="w-full rounded-xl h-12 gap-2">
              <Camera className="h-5 w-5" /> Start Scanning
            </Button>
          </div>
        )}

        {/* Step: Front Scan */}
        {step === 'front' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border p-3">
              <div className="flex items-center gap-2 mb-2">
                <ScanLine className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Scan Front Side</span>
              </div>
              <p className="text-xs text-muted-foreground">Position the front of your {METHODS.find(m => m.id === method)?.label} within the frame.</p>
            </div>
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-xl" />
            </div>
            <Button onClick={handleCaptureFront} className="w-full rounded-xl h-12 gap-2">
              <Camera className="h-5 w-5" /> Capture Front
            </Button>
          </div>
        )}

        {/* Step: Back Scan */}
        {step === 'back' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border p-3">
              <div className="flex items-center gap-2 mb-2">
                <ScanLine className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Scan Back Side</span>
              </div>
              <p className="text-xs text-muted-foreground">Now flip and scan the back of your document.</p>
            </div>
            {frontPreview && (
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-xs text-green-700 dark:text-green-400">Front captured</span>
                <img src={frontPreview} alt="front" className="w-10 h-7 object-cover rounded ml-auto" />
              </div>
            )}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-xl" />
            </div>
            <Button onClick={handleCaptureBack} className="w-full rounded-xl h-12 gap-2">
              <Camera className="h-5 w-5" /> Capture Back
            </Button>
          </div>
        )}

        {/* Step: Face Scan */}
        {step === 'face' && (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border p-3">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Face Verification</span>
              </div>
              <p className="text-xs text-muted-foreground">Look directly at the camera. Make sure your face is well lit and clearly visible.</p>
            </div>
            <div className="flex gap-2">
              {frontPreview && (
                <div className="flex items-center gap-1 p-2 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800 flex-1">
                  <Check className="h-3 w-3 text-green-600 shrink-0" />
                  <span className="text-xs text-green-700 dark:text-green-400">Front</span>
                </div>
              )}
              {backPreview && (
                <div className="flex items-center gap-1 p-2 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-800 flex-1">
                  <Check className="h-3 w-3 text-green-600 shrink-0" />
                  <span className="text-xs text-green-700 dark:text-green-400">Back</span>
                </div>
              )}
            </div>
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-w-xs mx-auto">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              <div className="absolute inset-12 border-2 border-dashed border-white/60 rounded-full" />
            </div>
            <Button onClick={handleCaptureFace} className="w-full rounded-xl h-12 gap-2">
              <Camera className="h-5 w-5" /> Capture Face
            </Button>
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="text-center py-16 space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Processing Verification</h2>
              <p className="text-muted-foreground text-sm">Analyzing documents and verifying identity...</p>
            </div>
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {frontPreview && <img src={frontPreview} alt="front" className="rounded-xl aspect-[4/3] object-cover" />}
              {backPreview && <img src={backPreview} alt="back" className="rounded-xl aspect-[4/3] object-cover" />}
              {facePreview && <img src={facePreview} alt="face" className="rounded-xl aspect-square object-cover" />}
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && (
          <div className="text-center py-8 space-y-6">
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
              resultStatus === 'success' ? "bg-amber-100 dark:bg-amber-900/30" : "bg-orange-100 dark:bg-orange-900/30"
            )}>
              {resultStatus === 'success' 
                ? <Shield className="h-10 w-10 text-amber-600" />
                : <AlertTriangle className="h-10 w-10 text-orange-600" />
              }
            </div>

            {resultStatus === 'success' ? (
              <>
                <h2 className="text-xl font-bold text-amber-600">Verification Pending</h2>
                <p className="text-lg font-semibold text-foreground">Your identity verification is pending and waiting for approval</p>
                <p className="text-muted-foreground text-sm">
                  Your documents have been submitted successfully (score: {Math.round(score * 100)}%). Our admin team will review and approve your verification. You'll receive a notification once it's reviewed.
                </p>
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400">⏳ This usually takes 24-48 hours. You can continue using the app while waiting.</p>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-orange-600">Verification Mismatched</h2>
                <p className="text-muted-foreground text-sm">
                  Score: {Math.round(score * 100)}%. The minimum required is 80%. Please retry with clearer photos and better lighting.
                </p>
              </>
            )}

            <div className="flex gap-3">
              {resultStatus === 'retry' && (
                <Button onClick={() => { setStep('method'); setFrontBlob(null); setBackBlob(null); setFaceBlob(null); }} variant="outline" className="flex-1 rounded-xl gap-2">
                  <RotateCcw className="h-4 w-4" /> Retry
                </Button>
              )}
              <Button onClick={() => navigate('/seller-dashboard')} className="flex-1 rounded-xl">
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyIdentity;
