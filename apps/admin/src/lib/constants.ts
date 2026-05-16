import type { LessonPreference } from "@eng/database";

// Fixed time slots for group scheduling (90-minute spacing)
export const TIME_SLOTS = [
  "07:00",
  "08:30",
  "10:00",
  "11:30",
  "13:00",
  "14:30",
  "16:00",
  "17:30",
  "19:00",
  "20:30",
  "22:00",
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

// Short level labels for compact displays (tables, schedule cells)
export const LEVEL_SHORT: Record<string, string> = {
  BEGINNER: "BEG",
  ELEMENTARY: "ELEM",
  PRE_INTERMEDIATE: "PRE",
  INTERMEDIATE: "INT",
  UPPER_INTERMEDIATE: "UPPER",
  IELTS: "IELTS",
};

// Full level labels for detail pages
export const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner",
  ELEMENTARY: "Elementary",
  PRE_INTERMEDIATE: "Pre-Intermediate",
  INTERMEDIATE: "Intermediate",
  UPPER_INTERMEDIATE: "Upper-Intermediate",
  IELTS: "IELTS",
};

// Lesson preference labels — `EITHER` reads as "Any" in the leads UI to match
// the preferences dialog. Reception uses a different "Either" label, kept
// locally there.
export const LESSON_LABEL: Record<LessonPreference, string> = {
  GROUP: "Group",
  INDIVIDUAL: "Individual",
  EITHER: "Any",
};

// Day pattern labels
export const DAYS_LABEL: Record<string, string> = {
  "1,3,5": "MWF",
  "2,4,6": "TTS",
};

export const DAY_SHORT: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

// Month names (1-indexed: MONTH_NAMES[1] = "Jan", MONTH_NAMES[12] = "Dec")
export const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const MONTH_NAMES_FULL = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// Short stage labels for compact displays
export const STAGE_SHORT: Record<string, string> = {
  BEGINNING: "BEG",
  MID: "MID",
  FINAL: "FIN",
};

// Linear ordering of level+stage positions for assignment distance calculations
export const LEVEL_STAGE_ORDER: string[] = [
  "BEGINNER:BEGINNING", "BEGINNER:MID", "BEGINNER:FINAL",
  "ELEMENTARY:BEGINNING", "ELEMENTARY:MID", "ELEMENTARY:FINAL",
  "PRE_INTERMEDIATE:BEGINNING", "PRE_INTERMEDIATE:MID", "PRE_INTERMEDIATE:FINAL",
  "INTERMEDIATE:BEGINNING", "INTERMEDIATE:MID", "INTERMEDIATE:FINAL",
  "UPPER_INTERMEDIATE:BEGINNING", "UPPER_INTERMEDIATE:MID", "UPPER_INTERMEDIATE:FINAL",
  "IELTS:BEGINNING", "IELTS:MID", "IELTS:FINAL",
];
