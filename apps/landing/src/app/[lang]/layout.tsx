import "@/styles/globals.css";
import type { Metadata } from "next";
import Script from "next/script";
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
    metadataBase: new URL("https://bananaschool.uz"),
    icons: {
      icon: [
        { url: "/banana_icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", type: "image/x-icon" },
      ],
      apple: "/og.png",
    },
    other: {
      "theme-color": "#FFE347",
    },
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
      images: [
        {
          url: "https://bananaschool.uz/og.png",
          width: 1200,
          height: 630,
          alt: "Banana School — Learn English Online",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
      images: ["https://bananaschool.uz/og.png"],
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
  const dict = await getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${geologica.variable} ${nunitoSans.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "EducationalOrganization",
              name: "Banana School",
              url: "https://bananaschool.uz",
              description: dict.meta.description,
              address: {
                "@type": "PostalAddress",
                addressLocality: "Tashkent",
                addressCountry: "UZ",
              },
              sameAs: ["https://instagram.com/bananaschool.uz"],
            }),
          }}
        />
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
            (window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=108772502', 'ym');

            ym(108772502, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
          `}
        </Script>
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/108772502"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-57G2LVY2SZ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-57G2LVY2SZ');
          `}
        </Script>
        {children}
        <FloatingContacts />
      </body>
    </html>
  );
}
