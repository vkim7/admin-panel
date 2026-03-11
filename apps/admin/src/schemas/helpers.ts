import { z } from "zod";

// --- String helpers ---

/** Required non-empty string (NOT NULL column). Trims whitespace. */
export const requiredString = (error = "Required") =>
  z.string().trim().min(1, { error });

/** Nullable string — empty/whitespace becomes null (NULL column). */
export const nullableString = (maxLength?: number) => {
  const base = maxLength ? z.string().max(maxLength) : z.string();
  return base
    .transform((val) => {
      const trimmed = val.trim();
      return trimmed === "" ? null : trimmed;
    })
    .nullable();
};

// --- ID helpers (handle string→number from form selects) ---

/** Required FK ID — rejects empty, converts string to number (NOT NULL FK). */
export const requiredId = (error = "Required") =>
  z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number({ error }).int().positive(),
  );

/** Nullable FK ID — empty becomes null, valid becomes number (NULL FK). */
export const nullableId = () =>
  z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    },
    z.number().int().positive().nullable(),
  );

// --- Number helpers ---

/** Required integer (NOT NULL INT). */
export const requiredInt = (error = "Required") =>
  z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number({ error }).int(),
  );

/** Nullable integer — empty becomes null (NULL INT). */
export const nullableInt = () =>
  z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    },
    z.number().int().nullable(),
  );

// --- Boolean helpers ---

/** Boolean with default (NOT NULL DEFAULT). */
export const booleanWithDefault = (defaultValue = false) =>
  z.boolean().default(defaultValue);

/** Nullable boolean — three-state: true/false/null (NULL BOOLEAN). */
export const nullableBoolean = () =>
  z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return null;
  }, z.boolean().nullable());

// --- Date helpers ---

/** Required ISO date string YYYY-MM-DD (NOT NULL DATE). */
export const requiredIsoDate = (error = "Required") =>
  z
    .string({ error })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Must be YYYY-MM-DD" });

/** Nullable ISO date — empty becomes null (NULL DATE). */
export const nullableIsoDate = () =>
  z.preprocess(
    (val) => {
      if (typeof val !== "string" || val.trim() === "") return null;
      return val;
    },
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Must be YYYY-MM-DD" })
      .nullable(),
  );

// --- Time helpers (HH:mm format, used across scheduling) ---

/** Required time string in HH:mm format. */
export const requiredTime = (error = "Required") =>
  z
    .string({ error })
    .trim()
    .regex(/^\d{2}:\d{2}$/, { error: "Must be HH:mm format" });

/** Nullable time string — empty becomes null. */
export const nullableTime = () =>
  z.preprocess(
    (val) => {
      if (typeof val !== "string" || val.trim() === "") return null;
      return val;
    },
    z
      .string()
      .regex(/^\d{2}:\d{2}$/, { error: "Must be HH:mm format" })
      .nullable(),
  );

// --- Array helpers (multi-select) ---

/** Required ID array — must select at least one. */
export const requiredIdArray = (error = "Select at least one") =>
  z.array(z.number().int().positive()).min(1, { error });

/** Optional ID array — can be empty. */
export const optionalIdArray = () =>
  z.array(z.number().int().positive()).default([]);

// --- Utility ---

/** Check if a value is blank (null, undefined, empty string, whitespace-only). */
export function isBlank(val: unknown): val is null | undefined | "" {
  if (val === null || val === undefined) return true;
  if (typeof val === "string") return val.trim() === "";
  return false;
}
