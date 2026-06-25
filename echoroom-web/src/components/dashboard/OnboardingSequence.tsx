"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { X, Check, Sparkles } from "lucide-react";
import { Card, CardContent, Button, cn } from "@/components/ui";

interface OnboardingState {
  completed: boolean;
}

const STORAGE_KEY = "echoroom-onboarding";

function loadCompleted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw) as OnboardingState;
    return state.completed === true;
  } catch {
    return false;
  }
}

function markCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: true }));
  } catch {
    // localStorage unavailable — fail silently
  }
}

interface OnboardingSequenceProps {
  callsCount: number;
  scenariosCount: number;
}

/**
 * A 3-step inline getting-started card shown only to new users.
 *
 * Steps are derived from props (not stored): choosing a character = creating a
 * scenario, making a call, and sharing a clip. The only persisted state is the
 * dismissal flag stored under `echoroom-onboarding` in localStorage.
 */
export function OnboardingSequence({ callsCount, scenariosCount }: OnboardingSequenceProps) {
  const [completed, setCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    setCompleted(loadCompleted());
  }, []);

  const handleDismiss = useCallback(() => {
    markCompleted();
    setCompleted(true);
  }, []);

  if (completed === null) return null; // still reading localStorage
  if (completed) return null;

  const stepCharacter = scenariosCount > 0;
  const stepCall = callsCount > 0;
  const stepClip = false; // future feature — always incomplete for now

  const steps = [
    { key: "stepCharacter", label: "Choisis un personnage", href: "/create", emoji: "🎭", done: stepCharacter },
    { key: "stepCall", label: "Lance ton premier appel", href: "/create", emoji: "📞", done: stepCall },
    { key: "stepClip", label: "Partage un clip", href: "/library", emoji: "🎬", done: stepClip },
  ];

  const currentStepIndex = steps.findIndex((s) => !s.done);

  return (
    <Card className="border-primary/20 bg-primary/5 mb-8">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Bienvenue dans le chaos !</h3>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => {
            const isCurrent = i === currentStepIndex;

            return (
              <div
                key={step.key}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-3 transition-colors",
                  isCurrent && "bg-primary/10 border border-primary/20",
                  step.done && "opacity-60",
                )}
              >
                {/* Circle indicator */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm",
                    step.done
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="w-4 h-4" /> : <span>{step.emoji}</span>}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.done ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                </div>

                {/* CTA for current step */}
                {isCurrent && !step.done && (
                  <Link href={step.href}>
                    <Button size="sm" variant="outline" className="shrink-0">
                      C&apos;est parti
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
