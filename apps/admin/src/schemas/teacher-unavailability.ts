import { z } from "zod";
import { requiredString, requiredIsoDate, nullableTime, nullableString } from "./helpers";

export const teacherUnavailabilitySchema = z
  .object({
    teacherId: requiredString("Teacher is required"),
    date: requiredIsoDate("Date is required"),
    startTime: nullableTime(),
    endTime: nullableTime(),
    reason: nullableString(500),
  })
  .refine(
    (data) => {
      // If startTime is null (whole day), endTime must also be null
      if (data.startTime === null && data.endTime !== null) return false;
      return true;
    },
    { message: "End time requires a start time", path: ["endTime"] },
  )
  .refine(
    (data) => {
      // If both set, endTime must be after startTime
      if (data.startTime && data.endTime) {
        return data.endTime > data.startTime;
      }
      return true;
    },
    { message: "End time must be after start time", path: ["endTime"] },
  );
