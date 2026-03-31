import { z } from "zod";
import { requiredString, requiredIsoDate } from "./helpers";

export const createHolidaySchema = z.object({
  name: requiredString("Name is required"),
  date: requiredIsoDate("Date is required"),
});

export type CreateHolidayValues = z.infer<typeof createHolidaySchema>;
