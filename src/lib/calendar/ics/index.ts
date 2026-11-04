import "server-only";
import type { CalendarItem, CalendarRange, GoogleStatus } from "../types";

/** Placeholder until the ICS reader lands: Google Calendar is off. */
export async function loadGoogleItems(
  _range: CalendarRange,
): Promise<{ items: CalendarItem[]; status: GoogleStatus }> {
  return { items: [], status: "off" };
}
