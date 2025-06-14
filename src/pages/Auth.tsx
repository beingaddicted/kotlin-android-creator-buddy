
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { toast } from "@/components/ui/use-toast";

const AuthPage = () => {
  const { user, session, loading, signIn, signUp } = useSupabaseAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate("/");
    }
  }, [session, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) toast({ title: "Login failed", description: error, variant: "destructive" });
      else toast({ title: "Login successful" });
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        toast({ title: "Sign up failed", description: error, variant: "destructive" });
      } else {
        toast({
          title: "Sign up successful",
          description: "A confirmation email has been sent to your inbox (if required).",
        });
      }
    }
    setPending(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">{mode === "login" ? "Login" : "Sign Up"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                required
                onChange={e => setEmail(e.target.value)}
                disabled={pending}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                required
                onChange={e => setPassword(e.target.value)}
                disabled={pending}
              />
              <Button type="submit" className="w-full" disabled={pending}>
                {mode === "login" ? "Log In" : "Sign Up"}
              </Button>
            </form>
            <div className="text-center mt-4">
              <Button
                variant="link"
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                disabled={pending}
              >
                {mode === "login"
                  ? "Don't have an account? Sign Up"
                  : "Already have an account? Log In"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
