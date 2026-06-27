import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ConsentBanner } from "@/components/shared/ConsentBanner";
import { Footer } from "@/components/shared/Footer";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { Toaster, ToastProvider } from "@/components/ui";
import { TRPCReactProvider } from "@/lib/trpc-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000"),
  title: "EchoRoom AI — AI Social Chaos Platform",
  description:
    "Créez des appels IA absurdes, partagez des moments viraux et explorez une communauté de scénarios sociaux générés par l'intelligence artificielle.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning est nécessaire car le thème (dark/light) est
    // défini statiquement par next-themes via l'attribut class. Next.js
    // n'a pas encore hydraté le ThemeProvider au moment du rendu initial.
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:text-sm focus:font-medium"
        >
          Aller au contenu principal
        </a>
        <ThemeProvider>
          <TRPCReactProvider>
            <SessionProvider>
              <ToastProvider>
                <PublicHeader />
                <div id="main-content" tabIndex={-1} className="flex flex-col min-h-screen">
                  <ConsentBanner />
                  {children}
                  <Footer />
                </div>
                <Toaster />
              </ToastProvider>
            </SessionProvider>
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
