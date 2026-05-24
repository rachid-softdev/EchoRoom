import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <nav className="px-6 py-4 border-b border-border">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l&apos;accueil
        </Link>
      </nav>

      <main className="flex-1 px-6 py-12 max-w-3xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
