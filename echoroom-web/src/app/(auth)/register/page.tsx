"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useMemo, useState } from "react";
import { MarketingNav } from "@/components/layout/MarketingNav";
import { PasswordStrengthMeter } from "@/components/shared/PasswordStrengthMeter";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
} from "@echoroom/ui";
import { api } from "@/lib/trpc";
import { useApiToast } from "@/lib/trpc-error";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [signInError, setSignInError] = useState("");

  const registerMutation = useApiToast(api.auth.register.useMutation(), {
    success: "Compte créé avec succès !",
    onSuccess: async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setSignInError("Compte créé mais erreur de connexion. Veuillez vous connecter.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    },
  });

  const error = registerMutation.error?.message ?? signInError;
  const loading = registerMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSignInError("");

    if (!consentAccepted) {
      setSignInError("Vous devez accepter les conditions d'utilisation");
      return;
    }

    registerMutation.mutate({
      email,
      username,
      password,
      consentAccepted: true,
    });
  }

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />
      <div className="flex-1 flex items-center justify-center px-6">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>Créer un compte</CardTitle>
            <CardDescription>5 crédits offerts pour commencer</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  aria-describedby={error ? "register-error" : undefined}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Nom d&apos;utilisateur
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Pseudo"
                  required
                  minLength={3}
                  maxLength={20}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  aria-describedby={error ? "register-error" : undefined}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Mot de passe
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 8 caractères"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    aria-describedby={error ? "register-error" : undefined}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={
                      showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.length > 0 && <PasswordStrengthMeter password={password} />}
              </div>

              {error && (
                <p id="register-error" className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                />
                <label
                  htmlFor="consent"
                  className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                >
                  J&apos;accepte les{" "}
                  <Link href="/terms" className="text-primary hover:underline">
                    conditions d&apos;utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    politique de confidentialité
                  </Link>
                  . En créant un compte, je confirme avoir au moins 13 ans.
                </label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !consentAccepted || passwordStrength < 3}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer mon compte"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Déjà un compte ?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Se connecter
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
