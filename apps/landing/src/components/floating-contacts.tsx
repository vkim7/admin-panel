import { MessageCircle, Phone } from "lucide-react";

export function FloatingContacts() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <a
        href="https://t.me/bananaschool_uz"
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 bg-main border-2 border-border rounded-full shadow-shadow flex items-center justify-center transition-all hover:shadow-[6px_6px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px]"
        aria-label="Telegram"
      >
        <MessageCircle size={24} strokeWidth={2.5} />
      </a>
      <a
        href="tel:+998979798808"
        className="w-14 h-14 bg-main border-2 border-border rounded-full shadow-shadow flex items-center justify-center transition-all hover:shadow-[6px_6px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px]"
        aria-label="Phone"
      >
        <Phone size={24} strokeWidth={2.5} />
      </a>
    </div>
  );
}
