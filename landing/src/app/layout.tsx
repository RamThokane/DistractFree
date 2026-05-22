import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DistractFree — AI-Powered Focus Companion",
  description: "Build sustainable focus habits with AI insights, smart website blocking, and streak coin rewards. Focus should feel empowering, not restrictive.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark scroll-smooth`}>
      <body className="bg-background text-foreground antialiased selection:bg-brand-purple/30 selection:text-text-primary overflow-x-hidden min-h-screen">
        {children}
      </body>
    </html>
  );
}
