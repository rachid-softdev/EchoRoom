import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            EchoRoom AI &mdash; {year}
          </p>
          <nav className="flex items-center gap-6">
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Conditions d&apos;utilisation
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Confidentialité
            </Link>
            <Link
              href="/legal"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Mentions légales
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
