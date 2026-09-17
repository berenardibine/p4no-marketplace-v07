import { useState, useEffect } from 'react';
import logoImg from '@/assets/logo.png';

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<'zoom' | 'fade-out' | 'done'>('zoom');

  useEffect(() => {
    if (sessionStorage.getItem('sm-splash-shown')) {
      onComplete();
      return;
    }

    const zoomTimer = setTimeout(() => setPhase('fade-out'), 4500);
    const completeTimer = setTimeout(() => {
      sessionStorage.setItem('sm-splash-shown', 'true');
      setPhase('done');
      onComplete();
    }, 7000);

    return () => {
      clearTimeout(zoomTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #DC2626 100%)',
        opacity: phase === 'fade-out' ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      <div
        className="flex flex-col items-center"
        style={{
          animation: 'splashZoom 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        <img
          src="/logo-v2.png"
          alt="p4no"
          className="w-28 h-28 rounded-[28px] shadow-2xl mb-6 object-contain"
          style={{
            boxShadow: '0 20px 60px -12px rgba(0,0,0,0.4)',
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
        />
        <h1
          className="text-3xl font-bold tracking-tight mb-2"
          style={{ color: 'white' }}
        >
          P4NO Hub
        </h1>
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
          Connect. Discover. Grow.
        </p>
      </div>

      <div
        className="absolute bottom-12 text-center"
        style={{
          animation: 'fadeInUp 0.8s ease-out 0.5s both',
        }}
      >
        <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Developed by
        </p>
        <p
          className="text-sm font-bold mt-0.5"
          style={{
            background: 'linear-gradient(90deg, #FBBF24, #F9FAFB, #60A5FA)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Smart Technology (+250798751685)
        </p>
      </div>

      <style>{`
        @keyframes splashZoom {
          0% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
