"use client";

import { Input } from "@/components/ui/input";

/**
 * Phone input for the landing forms. Visual mirrors the inline pattern the
 * forms used to render (dark `+998` chip + bare input); sanitization mirrors
 * the admin `PhoneInput`: digits only, capped at 9 (matches Uzbek phone
 * length). Uncontrolled — submits via the surrounding form's FormData under
 * `name="phone"`.
 */
export function PhoneInput({
  name = "phone",
  required,
}: {
  name?: string;
  required?: boolean;
}) {
  return (
    <div className="flex">
      <div className="flex items-center px-3 bg-foreground border-2 border-border rounded-l-base text-sm font-bold text-white">
        +998
      </div>
      <Input
        name={name}
        type="tel"
        inputMode="tel"
        maxLength={9}
        required={required}
        autoComplete="tel-national"
        onInput={(e) => {
          const el = e.currentTarget;
          const cleaned = el.value.replace(/\D/g, "").slice(0, 9);
          if (cleaned !== el.value) el.value = cleaned;
        }}
        className="rounded-l-none"
      />
    </div>
  );
}
