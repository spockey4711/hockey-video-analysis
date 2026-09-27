"use client";

import { presentationContent } from "./content";
import { PRESENTATION_SCALES, presentationScale } from "./presentation-scale";
import { usePresentationScale } from "./use-presentation-scale";

import { ChoiceGroup } from "@/components/forms/ChoiceGroup";

const { scale: copy } = presentationContent;

const OPTIONS = PRESENTATION_SCALES.map((value) => ({
  value,
  label: copy.choices[value],
}));

/**
 * The settings page's Normal / Groß / Sehr groß choice for the presentation
 * text size on this device; the presentation toolbar steps the same choice.
 */
export function PresentationScaleChoice() {
  const scale = usePresentationScale();

  return (
    <ChoiceGroup
      label={copy.label}
      options={OPTIONS}
      value={scale}
      onChange={presentationScale.write}
    />
  );
}
