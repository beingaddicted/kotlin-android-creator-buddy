
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useRateLimit } from "@/hooks/useRateLimit";
import { loginSchema, signupSchema } from "@/utils/validation";
import { sanitizeInput } from "@/utils/security";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

interface EmailAuthFormProps {
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
  onSubmit: (email: string, password: string, confirmPassword?: string) => Promise<void>;
  pending: boolean;
}

export const EmailAuthForm = ({ mode, onModeChange, onSubmit, pending }: EmailAuthFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { checkRateLimit, isRateLimited, remainingTime } = useRateLimit(5, 15 * 60 * 1000);
  const loginValidation = useFormValidation(loginSchema);
  const signupValidation = useFormValidation(signupSchema);

  const currentValidation = mode === "login" ? loginValidation : signupValidation;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const clientId = `${navigator.userAgent}_${window.location.hostname}`;
    if (!checkRateLimit(clientId)) {
      toast.error(`Too many attempts. Please wait ${remainingTime} seconds.`);
      return;
    }

    const sanitizedEmail = sanitizeInput(email);
    const formData = mode === "login" 
      ? { email: sanitizedEmail, password }
      : { email: sanitizedEmail, password, confirmPassword };

    const validation = currentValidation.validate(formData);

    if (!validation.isValid) {
      toast.error("Please fix the form errors");
      return;
    }

    await onSubmit(sanitizedEmail, password, confirmPassword);
  };

  const handleModeChange = () => {
    onModeChange(mode === "login" ? "signup" : "login");
    currentValidation.clearErrors();
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            required
            onChange={e => setEmail(e.target.value)}
            disabled={pending || isRateLimited}
            className={currentValidation.getFieldError('email') ? 'border-red-500' : ''}
          />
          {currentValidation.getFieldError('email') && (
            <p className="text-sm text-red-600 mt-1">
              {currentValidation.getFieldError('email')}
            </p>
          )}
        </div>

        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            required
            onChange={e => setPassword(e.target.value)}
            disabled={pending || isRateLimited}
            className={currentValidation.getFieldError('password') ? 'border-red-500' : ''}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          {currentValidation.getFieldError('password') && (
            <p className="text-sm text-red-600 mt-1">
              {currentValidation.getFieldError('password')}
            </p>
          )}
        </div>

        {mode === "signup" && (
          <>
            <PasswordStrengthIndicator password={password} />
            
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                required
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={pending || isRateLimited}
                className={currentValidation.getFieldError('confirmPassword') ? 'border-red-500' : ''}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {currentValidation.getFieldError('confirmPassword') && (
                <p className="text-sm text-red-600 mt-1">
                  {currentValidation.getFieldError('confirmPassword')}
                </p>
              )}
            </div>
          </>
        )}

        {isRateLimited && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-800">
              Too many attempts. Please wait {remainingTime} seconds before trying again.
            </p>
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full" 
          disabled={pending || isRateLimited || currentValidation.hasErrors}
        >
          {pending ? (
            <LoadingSpinner size="sm" />
          ) : (
            mode === "login" ? "Sign In" : "Create Account"
          )}
        </Button>
      </form>
      
      <div className="text-center mt-4">
        <Button
          variant="link"
          type="button"
          onClick={handleModeChange}
          disabled={pending}
        >
          {mode === "login"
            ? "Don't have an account? Sign Up"
            : "Already have an account? Sign In"}
        </Button>
      </div>

      {mode === "login" && (
        <div className="text-center mt-2">
          <Button variant="link" size="sm" disabled={pending}>
            Forgot your password?
          </Button>
        </div>
      )}
    </>
  );
};
