import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function AuthButtons() {
  const [session, setSession] = useState<
    Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [mode, setMode] = useState<"google" | "email" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading
      </Button>
    );
  }

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {session.user.email}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </Button>
      </div>
    );
  }

  if (mode === "email") {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex sm:items-center sm:gap-2">
          <Label htmlFor="email" className="sr-only">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-40"
          />
          <Label htmlFor="password" className="sr-only">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-40"
          />
        </div>
        <Button
          size="sm"
          disabled={signingIn || !email || !password}
          onClick={async () => {
            setSigningIn(true);
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (data.session) {
              setSession(data.session);
            } else if (error) {
              const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
              });
              if (signUpData.session) {
                setSession(signUpData.session);
              } else if (signUpError) {
                setSigningIn(false);
                alert("Auth failed: " + signUpError.message);
              }
            }
            setSigningIn(false);
          }}
        >
          {signingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign up / in
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          setSigningIn(true);
          const result = await lovable.auth.signInWithOAuth("google", {
            redirect_uri: window.location.origin,
          });
          if (result.error) {
            setSigningIn(false);
            console.error(result.error);
            alert("Sign in failed: " + result.error.message);
          }
        }}
        disabled={signingIn}
      >
        {signingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign in with Google
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setMode("email")}>
        Email
      </Button>
    </div>
  );
}
