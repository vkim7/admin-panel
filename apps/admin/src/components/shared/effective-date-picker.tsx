"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getUzbekistanTodayStr } from "@/lib/helpers/date";

interface EffectiveDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function EffectiveDatePicker({ value, onChange, disabled }: EffectiveDatePickerProps) {
  const minDate = getUzbekistanTodayStr();

  return (
    <div className="space-y-2">
      <Label htmlFor="effective-date">Effective date</Label>
      <Input
        id="effective-date"
        type="date"
        required
        min={minDate}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
