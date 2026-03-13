"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchFamiliesAction } from "@/lib/actions/families";
import { Search, X } from "lucide-react";

type FamilyResult = {
  id: string;
  parentFirstName: string;
  parentLastName: string;
  parentPhone: string;
  name: string | null;
  students: { id: string; firstName: string; lastName: string }[];
};

export type SelectedFamily = {
  id: string;
  parentFirstName: string;
  parentLastName: string;
  parentPhone: string;
};

interface FamilySearchProps {
  onSelect: (family: SelectedFamily) => void;
  onClear: () => void;
  selectedFamily?: SelectedFamily | null;
}

export function FamilySearch({ onSelect, onClear, selectedFamily }: FamilySearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FamilyResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    startTransition(async () => {
      const families = await searchFamiliesAction(value);
      setResults(families);
      setShowResults(true);
    });
  }

  if (selectedFamily) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
        <span>
          {selectedFamily.parentFirstName} {selectedFamily.parentLastName} — {selectedFamily.parentPhone}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-6"
          onClick={() => {
            onClear();
            setQuery("");
          }}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by parent phone, name, or student name..."
          className="pl-9"
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
        />
      </div>
      {showResults && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
          {results.map((f) => (
            <button
              key={f.id}
              type="button"
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect({
                  id: f.id,
                  parentFirstName: f.parentFirstName,
                  parentLastName: f.parentLastName,
                  parentPhone: f.parentPhone,
                });
                setShowResults(false);
                setQuery("");
              }}
            >
              <span className="font-medium">
                {f.parentFirstName} {f.parentLastName}
                {f.name && <span className="text-muted-foreground"> ({f.name})</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {f.parentPhone}
                {f.students.length > 0 && (
                  <> — Students: {f.students.map((s) => `${s.firstName} ${s.lastName}`).join(", ")}</>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
      {showResults && query.trim().length >= 2 && results.length === 0 && !isPending && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-md">
          No families found
        </div>
      )}
    </div>
  );
}
