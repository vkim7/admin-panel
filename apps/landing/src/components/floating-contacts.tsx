import { Phone } from "lucide-react";

export function FloatingContacts() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <a
        href="tel:+998979798808"
        className="w-14 h-14 bg-[#22a867] border-2 border-border rounded-full shadow-shadow flex items-center justify-center text-white transition-all hover:shadow-[6px_6px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px]"
        aria-label="Phone"
      >
        <Phone size={24} strokeWidth={2.5} />
      </a>
    </div>
  );
}
