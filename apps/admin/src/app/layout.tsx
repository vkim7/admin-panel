import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Admin Panel",
  description: "English courses admin panel",
  other: {
    ["yandex-verification"]: "2f720dc929713562",
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
        <meta name="yandex-verification" content="2f720dc929713562" />
      </head>
      <body className="bg-background min-h-screen font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
