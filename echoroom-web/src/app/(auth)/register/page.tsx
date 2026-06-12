"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
import { Checkbox } from "@/components/ui";
import { Phone, Loader2 } from "lucide-react";
import { PasswordStrengthMeter } from "@/components/shared/PasswordStrengthMeter";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!consentAccepted) {
      setError("Vous devez accepter les conditions d'utilisation");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/trpc/auth.register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          password,
          consentAccepted: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data?.message ?? "Erreur lors de l'inscription");
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Compte créé mais erreur de connexion. Veuillez vous connecter.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Une erreur est survenue. Réessayez plus tard.");
    } finally {
      setLoading(false);
    }
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
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="mb-8 flex items-center gap-2">
        <Phone className="w-6 h-6 text-primary" />
        <span className="text-xl font-bold">EchoRoom</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Créer un compte</CardTitle>
          <CardDescription>
            5 crédits offerts pour commencer
          </CardDescription>
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
              <Input
                id="password"
                type="password"
                placeholder="Minimum 8 caractères"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                aria-describedby={error ? "register-error" : undefined}
              />
              {password.length > 0 && (
                <PasswordStrengthMeter password={password} />
              )}
            </div>

            {error && (
              <p id="register-error" className="text-sm text-destructive" role="alert">{error}</p>
            )}

            <div className="flex items-start gap-3">
              <Checkbox
                id="consent"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
              />
              <label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                J&apos;accepte les{" "}
                <Link href="/terms" className="text-primary hover:underline">conditions d&apos;utilisation</Link>{" "}
                et la{" "}
                <Link href="/privacy" className="text-primary hover:underline">politique de confidentialité</Link>.
                En créant un compte, je confirme avoir au moins 13 ans.
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !consentAccepted || passwordStrength < 3}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Créer mon compte"
              )}
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
  );
}
