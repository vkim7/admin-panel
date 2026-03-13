import { z } from "zod";
import { requiredString, requiredPhone, nullableString } from "./helpers";

export const familySchema = z.object({
  parentFirstName: requiredString("Parent first name is required"),
  parentLastName: requiredString("Parent last name is required"),
  parentPhone: requiredPhone(),
  name: nullableString(100),
});

export type FamilyFormValues = z.infer<typeof familySchema>;
