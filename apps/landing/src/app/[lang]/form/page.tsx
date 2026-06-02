import { getDictionary, isValidLocale } from "@/lib/i18n";
import { VerifyForm } from "@/components/verify-form";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function FormPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);

  return (
    <div className="min-h-dvh bg-secondary-background flex flex-col items-center justify-center px-4 py-8">
      <div className="flex items-center justify-between w-full max-w-md mb-6">
        <img src="/logo_black.svg" alt="Banana School" className="h-8" />
        <LanguageSwitcher currentLocale={locale} pathSuffix="/form" />
      </div>
      <div className="w-full max-w-md">
        <VerifyForm dict={dict.verify} locale={locale} />
      </div>
    </div>
  );
}
