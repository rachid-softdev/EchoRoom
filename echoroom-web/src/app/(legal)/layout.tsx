import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation bar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 h-14">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l&apos;accueil
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            <span className="text-base font-bold">EchoRoom</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {children}
      </div>

      {/* Footer note */}
      <footer className="border-t border-border">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} EchoRoom AI</span>
          <div className="flex items-center gap-4">
            <Link href="/legal" className="hover:text-foreground transition-colors">
              Mentions légales
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Confidentialité
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Conditions
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
