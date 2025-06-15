
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { useOptimizedOperations } from "@/hooks/useOptimizedOperations";
import { toast } from "sonner";

const AuthPage = () => {
  const { user, session, loading, signIn, signUp } = useSupabaseAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [pending, setPending] = useState(false);
  const { debounce, throttle } = useOptimizedOperations();

  // Memoize navigation effect to prevent unnecessary re-runs
  useEffect(() => {
    if (!loading && session) {
      navigate("/");
    }
  }, [session, loading, navigate]);

  // Throttled email auth handler to prevent rapid successive calls
  const handleEmailAuth = useCallback(
    throttle(
      'email-auth',
      async (email: string, password: string, confirmPassword?: string) => {
        setPending(true);
        
        try {
          if (mode === "login") {
            const { error } = await signIn(email, password);
            if (error) {
              toast.error(`Login failed: ${error}`);
            } else {
              toast.success("Login successful!");
            }
          } else {
            const { error } = await signUp(email, password);
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
      },
      1000
    ),
    [mode, signIn, signUp, throttle]
  );

  // Memoize loading state to prevent unnecessary re-renders
  const loadingState = useMemo(() => {
    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      );
    }
    return null;
  }, [loading]);

  // Memoize auth content to prevent unnecessary re-renders
  const authContent = useMemo(() => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="animate-fade-in">
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
            <SocialSignInButtons disabled={pending} />
            
            <EmailAuthForm
              mode={mode}
              onModeChange={setMode}
              onSubmit={handleEmailAuth}
              pending={pending}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  ), [mode, pending, handleEmailAuth]);

  if (loadingState) {
    return loadingState;
  }

  return authContent;
};

export default AuthPage;
