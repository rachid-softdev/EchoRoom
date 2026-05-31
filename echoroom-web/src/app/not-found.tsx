import Link from "next/link";
import { Button } from "@/components/ui";
import { Home, Frown } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Frown className="w-16 h-16 text-muted-foreground mb-6" />
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-8">
        Oops&apos; — cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Link href="/">
        <Button className="gap-2">
          <Home className="w-4 h-4" />
          Retour à l&apos;accueil
        </Button>
      </Link>
    </div>
  );
}
