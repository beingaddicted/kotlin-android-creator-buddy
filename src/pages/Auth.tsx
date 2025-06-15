
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useRateLimit } from "@/hooks/useRateLimit";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { loginSchema, signupSchema } from "@/utils/validation";
import { sanitizeInput } from "@/utils/security";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AuthPage = () => {
  const { user, session, loading, signIn, signUp } = useSupabaseAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [socialPending, setSocialPending] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { checkRateLimit, isRateLimited, remainingTime } = useRateLimit(5, 15 * 60 * 1000);
  
  const loginValidation = useFormValidation(loginSchema);
  const signupValidation = useFormValidation(signupSchema);

  useEffect(() => {
    if (!loading && session) {
      navigate("/");
    }
  }, [session, loading, navigate]);

  const handleSocialSignIn = async (provider: 'google' | 'facebook') => {
    setSocialPending(provider);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + "/"
        }
      });
      
      if (error) {
        toast.error(`${provider} sign-in failed: ${error.message}`);
      }
    } catch (error) {
      toast.error(`An error occurred with ${provider} sign-in`);
      console.error(`${provider} sign-in error:`, error);
    } finally {
      setSocialPending(null);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
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

    const validation = mode === "login" 
      ? loginValidation.validate(formData)
      : signupValidation.validate(formData);

    if (!validation.isValid) {
      toast.error("Please fix the form errors");
      return;
    }

    setPending(true);
    
    try {
      if (mode === "login") {
        const { error } = await signIn(sanitizedEmail, password);
        if (error) {
          toast.error(`Login failed: ${error}`);
        } else {
          toast.success("Login successful!");
        }
      } else {
        const { error } = await signUp(sanitizedEmail, password);
        if (error) {
          toast.error(`Sign up failed: ${error}`);
        } else {
          toast.success("Sign up successful! Please check your email for verification.");
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Auth error:", error);
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  const currentValidation = mode === "login" ? loginValidation : signupValidation;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <p className="text-center text-sm text-gray-600">
              {mode === "login" 
                ? "Sign in to your account to continue" 
                : "Join us and start tracking your organization"
              }
            </p>
          </CardHeader>
          <CardContent>
            {/* Social Sign-in Buttons */}
            <div className="space-y-3 mb-6">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={() => handleSocialSignIn('google')}
                disabled={pending || socialPending === 'google' || isRateLimited}
              >
                {socialPending === 'google' ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={() => handleSocialSignIn('facebook')}
                disabled={pending || socialPending === 'facebook' || isRateLimited}
              >
                {socialPending === 'facebook' ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Continue with Facebook
                  </>
                )}
              </Button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
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
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  currentValidation.clearErrors();
                  setPassword("");
                  setConfirmPassword("");
                }}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
