"use client";

import * as React from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupInput,
} from "@/components/ui/input-group";

const COUNTRY_PREFIX = "+998";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  disabled?: boolean;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, ...props }, ref) => {
    const displayValue =
      typeof value === "string" && value.startsWith(COUNTRY_PREFIX)
        ? value.slice(COUNTRY_PREFIX.length)
        : value || "";

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digits = e.target.value.replace(/\D/g, "");
      onChange(digits ? `${COUNTRY_PREFIX}${digits}` : "");
    }

    return (
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>{COUNTRY_PREFIX}</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          maxLength={9}
          inputMode="tel"
          {...props}
        />
      </InputGroup>
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
