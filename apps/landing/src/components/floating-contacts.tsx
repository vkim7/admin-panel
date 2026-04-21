import { MessageCircle, Phone } from "lucide-react";

export function FloatingContacts() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <a
        href="https://t.me/bananaschool_uz"
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 bg-sky-blue-bg border-2 border-border rounded-full shadow-shadow flex items-center justify-center transition-all hover:shadow-[6px_6px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px]"
        aria-label="Telegram"
      >
        <MessageCircle size={24} strokeWidth={2.5} />
      </a>
      <a
        href="https://www.instagram.com/bananaschool.uz/"
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 bg-purple-bg border-2 border-border rounded-full shadow-shadow flex items-center justify-center transition-all hover:shadow-[6px_6px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px]"
        aria-label="Instagram"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" /></svg>
      </a>
      <a
        href="tel:+998979798808"
        className="w-14 h-14 bg-leaf-green-bg border-2 border-border rounded-full shadow-shadow flex items-center justify-center transition-all hover:shadow-[6px_6px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px]"
        aria-label="Phone"
      >
        <Phone size={24} strokeWidth={2.5} />
      </a>
    </div>
  );
}
