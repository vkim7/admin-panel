import Link from "next/link";

interface FooterProps {
  locale: string;
}

export function Footer({ locale }: FooterProps) {
  const isRu = locale === "ru";

  return (
    <footer className="border-t-2 border-border bg-background py-10">
      <div className="max-w-[1080px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[13px] text-foreground/60">
        <span>© 2026 Banana School. Tashkent, Uzbekistan.</span>
        <Link
          href={`/${locale}/privacy`}
          className="hover:text-foreground transition-colors font-medium"
        >
          {isRu ? "Политика конфиденциальности" : "Maxfiylik siyosati"}
        </Link>
      </div>
    </footer>
  );
}
