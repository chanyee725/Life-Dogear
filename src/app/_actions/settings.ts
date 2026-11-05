"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/app/_actions/result";
import { currentAuthMode } from "@/lib/auth/server";
import { saveSetting, settingsView, type SettingsView } from "@/lib/settings";

/**
 * Saves one app-editable setting (empty value = back to the env) and returns the masked view.
 * The value is never echoed back, logged or put in an error message.
 */
export async function saveAppSetting(
  key: unknown,
  value: unknown,
): Promise<ActionResult<SettingsView>> {
  return runAction(async () => {
    await saveSetting(key, value);
    // The calendar reads these on every render: home, tasks (calendar view), settings.
    revalidatePath("/", "layout");
    return settingsView((await currentAuthMode()).kind);
  });
}
