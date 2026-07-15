import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  Eye,
  EyeOff,
  FastForward,
  Film,
  Flag,
  Link,
  Loader,
  LogOut,
  type LucideIcon,
  type LucideProps,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  Rewind,
  Scissors,
  Search,
  Settings,
  Share2,
  Sparkles,
  StepBack,
  StepForward,
  Sun,
  Tag,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

import { cn } from "./cn";

/**
 * Curated Lucide glyph set for the coach app, keyed by the kebab-case names the
 * design reference uses (see docs/design/README.md "Iconography"). Named imports
 * keep the bundle tree-shakeable; extend this map as new glyphs are needed
 * rather than importing the full Lucide barrel.
 */
const REGISTRY = {
  "alert-triangle": AlertTriangle,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  clock: Clock,
  download: Download,
  eye: Eye,
  "eye-off": EyeOff,
  "fast-forward": FastForward,
  film: Film,
  flag: Flag,
  link: Link,
  loader: Loader,
  "log-out": LogOut,
  moon: Moon,
  pause: Pause,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  rewind: Rewind,
  scissors: Scissors,
  search: Search,
  settings: Settings,
  "share-2": Share2,
  sparkles: Sparkles,
  "step-back": StepBack,
  "step-forward": StepForward,
  sun: Sun,
  tag: Tag,
  "trash-2": Trash2,
  user: User,
  users: Users,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof REGISTRY;

export interface IconProps extends Omit<LucideProps, "ref"> {
  /** Glyph to render; one of the curated {@link REGISTRY} names. */
  name: IconName;
  /** Edge length in px (Lucide draws on a square viewBox). Defaults to 18. */
  size?: number;
}

/**
 * Lucide glyph wrapper. Decorative by default (`aria-hidden`) - label the
 * interactive parent (e.g. IconButton) rather than the icon. Pass `aria-hidden`
 * or `aria-label` explicitly to override.
 */
export function Icon({ name, size = 18, className, ...rest }: IconProps) {
  const Glyph = REGISTRY[name];
  return (
    <Glyph
      size={size}
      aria-hidden
      className={cn("shrink-0", className)}
      {...rest}
    />
  );
}
