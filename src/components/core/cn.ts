import { twMerge } from "tailwind-merge";

/**
 * Class-name value accepted by {@link cn}. Supports the `condition && "class"`
 * idiom used throughout the component library, plus plain strings.
 */
export type ClassValue = string | number | false | null | undefined;

/**
 * Join conditional class names and resolve conflicting Tailwind utilities so a
 * caller-supplied `className` reliably overrides a component's defaults (the
 * last conflicting utility wins). Every primitive routes its class list through
 * this helper.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(inputs.filter(Boolean).join(" "));
}
