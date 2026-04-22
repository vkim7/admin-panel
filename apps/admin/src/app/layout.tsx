import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Admin Panel",
  description: "English courses admin panel",
  other: {
    ["yandex-verification"]: "ee2da55dad6b65ad",
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable}>
      <head>
        <meta name="yandex-verification" content="ee2da55dad6b65ad" />
      </head>
      <body className="bg-background min-h-screen font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
