import { getDictionary, isValidLocale } from "@/lib/i18n";
import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Stats } from "@/components/stats";
import { Features } from "@/components/features";
import { HowItWorks } from "@/components/how-it-works";
import { Pricing } from "@/components/pricing";
import { Faq } from "@/components/faq";
import { CtaForm } from "@/components/cta-form";
import { Footer } from "@/components/footer";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);

  return (
    <>
      <Nav dict={dict.nav} locale={locale} />
      <main>
        <Hero dict={dict.hero} locale={locale} />
        <Stats dict={dict.stats} />
        <Features dict={dict.features} />
        <HowItWorks dict={dict.howItWorks} />
        <Pricing dict={dict.pricing} locale={locale} />
        <Faq dict={dict.faq} />
        <CtaForm dict={dict.form} locale={locale} />
      </main>
      <Footer dict={dict.footer} locale={locale} />
    </>
  );
}
