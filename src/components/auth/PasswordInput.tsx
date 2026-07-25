import { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  showRequirements?: boolean;
  placeholder?: string;
  id?: string;
}

const PasswordInput = ({
  value,
  onChange,
  label = 'Password',
  showRequirements = false,
  placeholder = 'Enter your password',
  id = 'password'
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const requirements = [
    { label: 'At least 8 characters', test: value.length >= 8 },
    { label: 'One uppercase letter', test: /[A-Z]/.test(value) },
    { label: 'One lowercase letter', test: /[a-z]/.test(value) },
    { label: 'One number', test: /[0-9]/.test(value) },
    { label: 'One special character (!@#$%^&*)', test: /[!@#$%^&*(),.?":{}|<>]/.test(value) },
  ];

  const isValid = requirements.every(req => req.test);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10 h-12 bg-white/80 border-border/50 focus:border-primary focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      
      {showRequirements && value && (
        <div className="space-y-1.5 pt-2">
          <p className="text-xs font-medium text-muted-foreground">Password must contain:</p>
          <div className="grid grid-cols-1 gap-1">
            {requirements.map((req, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-2 text-xs transition-colors",
                  req.test ? "text-green-600" : "text-muted-foreground"
                )}
              >
                {req.test ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                {req.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswordInput;
export { PasswordInput };
export const validatePassword = (password: string) => {
  const requirements = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[!@#$%^&*(),.?":{}|<>]/.test(password),
  ];
  return requirements.every(Boolean);
};
