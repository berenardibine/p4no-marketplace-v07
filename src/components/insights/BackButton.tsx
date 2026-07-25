import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  to?: string;
  label?: string;
  className?: string;
}

const BackButton = ({ to, label = 'Back', className = '' }: Props) => {
  const navigate = useNavigate();
  const handle = () => {
    if (to) navigate(to);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/insights');
  };
  return (
    <button
      type="button"
      onClick={handle}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-muted/80 hover:bg-muted text-foreground text-sm font-semibold transition-colors ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
};

export default BackButton;