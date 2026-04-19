import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";

interface NavProps {
  dict: Dictionary["nav"];
  locale: string;
}

export function Nav({ dict, locale }: NavProps) {
  return (
    <nav className="sticky top-0 z-50 border-b-2 border-border bg-white/92 backdrop-blur-md">
      <div className="max-w-[1080px] mx-auto px-6 flex items-center justify-between h-[60px]">
        <Link href={`/${locale}`} className="flex items-center">
          <img src="/logo_black.svg" alt="Banana School" className="h-7 w-auto" />
        </Link>

        <ul className="flex items-center gap-1">
          <li className="hidden md:block">
            <Link
              href={`/${locale}#features`}
              className="px-4 py-2 text-[15px] font-semibold text-foreground rounded-base transition-colors hover:bg-background"
            >
              {dict.whyUs}
            </Link>
          </li>
          <li className="hidden md:block">
            <Link
              href={`/${locale}#pricing`}
              className="px-4 py-2 text-[15px] font-semibold text-foreground rounded-base transition-colors hover:bg-background"
            >
              {dict.pricing}
            </Link>
          </li>
          <li className="hidden md:block">
            <Link
              href={`/${locale}#faq`}
              className="px-4 py-2 text-[15px] font-semibold text-foreground rounded-base transition-colors hover:bg-background"
            >
              {dict.faq}
            </Link>
          </li>
          <li className="mr-2">
            <LanguageSwitcher currentLocale={locale} />
          </li>
          <li>
            <Button asChild className="rounded-full shadow-[2px_2px_0_var(--border)] hover:shadow-[3px_3px_0_var(--border)] hover:translate-x-[-1px] hover:translate-y-[-1px]">
              <Link href={`/${locale}#cta`}>{dict.cta}</Link>
            </Button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
