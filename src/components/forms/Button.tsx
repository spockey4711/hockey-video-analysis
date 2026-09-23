"use client";

import type { ButtonHTMLAttributes, Ref } from "react";

import { Icon, type IconName } from "../core/Icon";
import { cn } from "../core/cn";

import {
  BUTTON_ICON_SIZE,
  buttonClassName,
  type ButtonSize,
  type ButtonVariant,
} from "./button-styles";

export type { ButtonSize, ButtonVariant } from "./button-styles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Glyph rendered before the label. */
  iconLeft?: IconName;
  /** Glyph rendered after the label. */
  iconRight?: IconName;
  /** Stretch to the full width of the container. */
  full?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Primary action control with variant/size and optional leading/trailing icons. */
export function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  full = false,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const glyph = BUTTON_ICON_SIZE[size];
  return (
    <button
      type={type}
      className={cn(buttonClassName({ variant, size, full }), className)}
      {...rest}
    >
      {iconLeft && <Icon name={iconLeft} size={glyph} />}
      {children}
      {iconRight && <Icon name={iconRight} size={glyph} />}
    </button>
  );
}
