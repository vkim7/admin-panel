"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";

interface NavProps {
  dict: Dictionary["nav"];
  locale: string;
}

export function Nav({ dict, locale }: NavProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-border bg-white/92 backdrop-blur-md">
      <div className="max-w-[1080px] mx-auto px-6 flex items-center justify-between h-[60px]">
        <Link href={`/${locale}`} className="flex items-center">
          <img src="/logo_black.svg" alt="Banana School" className="h-7 w-auto" />
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-1">
          <li>
            <Link
              href={`/${locale}#pricing`}
              className="px-4 py-2 text-[15px] font-semibold text-foreground rounded-base transition-colors hover:bg-background"
            >
              {dict.pricing}
            </Link>
          </li>
          <li>
            <Link
              href={`/${locale}#faq`}
              className="px-4 py-2 text-[15px] font-semibold text-foreground rounded-base transition-colors hover:bg-background"
            >
              {dict.faq}
            </Link>
          </li>
          <li>
            <a
              href="/public_offer.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-[15px] font-semibold text-foreground rounded-base transition-colors hover:bg-background"
            >
              {dict.offer}
            </a>
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

        {/* Mobile: language switcher + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <LanguageSwitcher currentLocale={locale} />
          <button
            onClick={() => setOpen(!open)}
            className="w-10 h-10 flex items-center justify-center rounded-base border-2 border-border bg-white shadow-[2px_2px_0_var(--border)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            aria-label="Menu"
          >
            {open ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t-2 border-border bg-white px-6 py-4 space-y-1">
          <Link
            href={`/${locale}#pricing`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-[15px] font-semibold text-foreground rounded-base transition-colors hover:bg-background"
          >
            {dict.pricing}
          </Link>
          <Link
            href={`/${locale}#faq`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-[15px] font-semibold text-foreground rounded-base transition-colors hover:bg-background"
          >
            {dict.faq}
          </Link>
          <a
            href="/public_offer.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 text-[15px] font-semibold text-foreground rounded-base transition-colors hover:bg-background"
          >
            {dict.offer}
          </a>
        </div>
      )}
    </nav>
  );
}
