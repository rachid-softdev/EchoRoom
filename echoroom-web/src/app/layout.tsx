import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { TRPCReactProvider } from "@/lib/trpc-provider";
import { ToastProvider, Toaster } from "@/components/ui";
import { Footer } from "@/components/shared/Footer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "EchoRoom AI — AI Social Chaos Platform",
  description:
    "Créez des appels IA absurdes, partagez des moments viraux et explorez une communauté de scénarios sociaux générés par l'intelligence artificielle.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <TRPCReactProvider>
          <SessionProvider>
            <ToastProvider>
              <div className="flex flex-col min-h-screen">
                {children}
                <Footer />
              </div>
              <Toaster />
            </ToastProvider>
          </SessionProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
