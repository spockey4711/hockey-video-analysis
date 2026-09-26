"use server";

import { revalidatePath } from "next/cache";

import { tagWindowsContent } from "./content";
import {
  RESET_INTENT,
  parseTagWindowsInput,
  type TagWindowField,
} from "./form";
import { resetTagWindows, setTagWindows } from "./queries";

import { requireCoach } from "@/features/access";

const { problems, errors } = tagWindowsContent;

/** Shape returned to `useActionState`; the empty object is the initial state. */
export interface TagWindowsFormState {
  error?: string;
  fieldErrors?: Partial<Record<TagWindowField, string>>;
  /** Which request succeeded, so the form confirms the right one. */
  success?: "saved" | "reset";
}

// The watch page hands the windows to capture, so it must not serve stale ones.
function revalidateWindows(): void {
  revalidatePath("/settings");
  revalidatePath("/games/[id]/watch", "page");
}

/**
 * Save the team's tag windows (Einstellungen > Tag-Fenster), or reset them all
 * to the defaults when the form's `intent` is {@link RESET_INTENT}. Coach-only.
 * Only whole seconds inside the bounds reach the database.
 */
export async function saveTagWindowsAction(
  _prev: TagWindowsFormState,
  formData: FormData,
): Promise<TagWindowsFormState> {
  await requireCoach();

  if (formData.get("intent") === RESET_INTENT) {
    try {
      await resetTagWindows();
    } catch (cause) {
      console.error("failed to reset the tag windows", cause);
      return { error: errors.unexpected };
    }
    revalidateWindows();
    return { success: "reset" };
  }

  const parsed = parseTagWindowsInput((field) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : undefined;
  });
  if (!parsed.ok) {
    return {
      error: problems.summary,
      fieldErrors: Object.fromEntries(
        parsed.invalid.map((field) => [
          field,
          field.endsWith(".preS") ? problems.preS : problems.postS,
        ]),
      ),
    };
  }

  try {
    await setTagWindows(parsed.value);
  } catch (cause) {
    console.error("failed to save the tag windows", cause);
    return { error: errors.unexpected };
  }
  revalidateWindows();
  return { success: "saved" };
}
