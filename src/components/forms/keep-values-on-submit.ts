"use client";

import { startTransition, type FormEvent } from "react";

/**
 * A form's submit handler that runs its action without React's automatic form
 * reset. After an action React resets the form's DOM to its initial values:
 * uncontrolled fields lose what the coach typed even when the action returned
 * errors, and a controlled `<select>` is not re-synced afterwards, so it shows
 * its first-rendered option while its state says another. Pass the
 * `useActionState` dispatcher; keep it as the form's `action` too, so the form
 * still submits without JavaScript.
 */
export function keepValuesOnSubmit(
  formAction: (formData: FormData) => void,
): (event: FormEvent<HTMLFormElement>) => void {
  return (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
}
