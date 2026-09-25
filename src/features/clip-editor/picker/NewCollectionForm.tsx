"use client";

import { type FormEvent, useState } from "react";

import type { CreateOutcome } from "./client";
import { pickerContent } from "./content";

import { Button } from "@/components/forms/Button";
import { Input } from "@/components/forms/Input";
import { MAX_NAME_LENGTH } from "@/features/share/collections/validation";

export interface NewCollectionFormProps {
  /**
   * Create the collection named `name` and go on with it; the form only shows
   * what went wrong. Called straight from the submit, so it may open a tab.
   */
  readonly create: (name: string) => Promise<CreateOutcome>;
  readonly submitLabel: string;
}

const { create: copy } = pickerContent;

/**
 * A new collection's name, for "Neue Sammlung" in the clip editor and on the
 * watch page. The caller decides what creating means and where the coach
 * goes next; the form stays busy until that is done.
 */
export function NewCollectionForm({
  create,
  submitLabel,
}: NewCollectionFormProps) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const outcome = await create(name);
    if (outcome.status !== "created") {
      setError(
        outcome.status === "invalid-name" ? copy.invalidName : copy.failed,
      );
    }
    setPending(false);
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-[var(--space-3)]"
    >
      <Input
        name="name"
        label={copy.label}
        placeholder={copy.placeholder}
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={MAX_NAME_LENGTH}
        error={error}
        autoComplete="off"
        required
      />
      <div>
        <Button type="submit" iconLeft="plus" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
