import "@/styles/globals.css";
import type { Metadata } from "next";
import { Geologica, Nunito_Sans } from "next/font/google";
import { getDictionary, isValidLocale } from "@/lib/i18n";
import { FloatingContacts } from "@/components/floating-contacts";

const geologica = Geologica({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geologica",
  display: "swap",
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin", "cyrillic"],
  variable: "--font-nunito-sans",
  display: "swap",
});

export async function generateStaticParams() {
  return [{ lang: "uz" }, { lang: "ru" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);

  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: `https://bananaschool.uz/${locale}`,
      languages: {
        uz: "https://bananaschool.uz/uz",
        ru: "https://bananaschool.uz/ru",
      },
    },
    verification: {
      yandex: "ee2da55dad6b65ad",
    },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      url: `https://bananaschool.uz/${locale}`,
      siteName: "Banana School",
      locale: locale === "uz" ? "uz_UZ" : "ru_RU",
      type: "website",
      // TODO: Add OG image when provided
      // images: [{ url: "https://bananaschool.uz/og-image.jpg", width: 1200, height: 630 }],
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : "uz";

  return (
    <html
      lang={locale}
      className={`${geologica.variable} ${nunitoSans.variable}`}
    >
      <body>
        {children}
        <FloatingContacts />
      </body>
    </html>
  );
}
