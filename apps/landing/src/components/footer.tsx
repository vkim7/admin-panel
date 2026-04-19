import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

interface FooterProps {
  dict: Dictionary["footer"];
  locale: string;
}

export function Footer({ dict, locale }: FooterProps) {
  return (
    <footer className="border-t-2 border-border bg-white py-10">
      <div className="max-w-[1080px] mx-auto px-6 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center">
          <img src="/logo_black.svg" alt="Banana School" className="h-6 w-auto" />
        </div>

        <ul className="flex gap-6 list-none">
          <li>
            <a
              href="https://www.instagram.com/bananaschool.uz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/60 text-sm font-semibold hover:text-foreground transition-colors"
            >
              Instagram
            </a>
          </li>
          <li>
            <Link
              href={`/${locale}#features`}
              className="text-foreground/60 text-sm font-semibold hover:text-foreground transition-colors"
            >
              {locale === "ru" ? "\u041F\u043E\u0447\u0435\u043C\u0443 \u043C\u044B" : "Nega biz"}
            </Link>
          </li>
          <li>
            <Link
              href={`/${locale}#pricing`}
              className="text-foreground/60 text-sm font-semibold hover:text-foreground transition-colors"
            >
              {locale === "ru" ? "\u0426\u0435\u043D\u0430" : "Narx"}
            </Link>
          </li>
          <li>
            <Link
              href={`/${locale}#faq`}
              className="text-foreground/60 text-sm font-semibold hover:text-foreground transition-colors"
            >
              FAQ
            </Link>
          </li>
        </ul>

        <div className="w-full text-center mt-5 pt-5 border-t border-border/20 text-foreground/60 text-[13px]">
          {dict.copyright}
        </div>
      </div>
    </footer>
  );
}
