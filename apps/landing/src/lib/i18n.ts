import type uzDict from "@/dictionaries/uz.json";

export type Locale = "uz" | "ru";
export type Dictionary = typeof uzDict;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  uz: () => import("@/dictionaries/uz.json").then((m) => m.default),
  ru: () => import("@/dictionaries/ru.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loader = dictionaries[locale];
  if (!loader) return dictionaries.uz();
  return loader();
}

export function isValidLocale(lang: string): lang is Locale {
  return lang === "uz" || lang === "ru";
}
