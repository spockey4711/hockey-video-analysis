import {
  ALargeSmall,
  AlertTriangle,
  ArrowUpRight,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  ClipboardPaste,
  Clock,
  Columns2,
  Copy,
  Download,
  Ellipse,
  Eye,
  EyeOff,
  FastForward,
  Film,
  Flag,
  ImageIcon,
  Laptop,
  Link,
  Loader,
  LogOut,
  Maximize,
  MessageSquare,
  Minimize,
  Minus,
  Monitor,
  type LucideIcon,
  type LucideProps,
  Moon,
  MousePointer2,
  Pause,
  Pencil,
  Pentagon,
  PenTool,
  Pin,
  Play,
  Plus,
  Redo2,
  Rewind,
  RotateCcw,
  Scissors,
  Search,
  Settings,
  Share2,
  Smartphone,
  Sparkles,
  Spline,
  Square,
  StickyNote,
  StepBack,
  StepForward,
  Sun,
  Tablet,
  Tag,
  Trash2,
  TrianglesCenterlineDashedHorizontal,
  TrianglesCenterlineDashedVertical,
  Type,
  Undo2,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from "lucide-react";

import { cn } from "./cn";

/**
 * Curated Lucide glyph set for the coach app, keyed by the kebab-case names the
 * design reference uses (see docs/design/README.md "Iconography"). Named imports
 * keep the bundle tree-shakeable; extend this map as new glyphs are needed
 * rather than importing the full Lucide barrel.
 */
const REGISTRY = {
  "a-large-small": ALargeSmall,
  "alert-triangle": AlertTriangle,
  "arrow-up-right": ArrowUpRight,
  "chart-column": ChartColumn,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  circle: Circle,
  "columns-2": Columns2,
  copy: Copy,
  "clipboard-paste": ClipboardPaste,
  clock: Clock,
  download: Download,
  ellipse: Ellipse,
  eye: Eye,
  "eye-off": EyeOff,
  "fast-forward": FastForward,
  film: Film,
  flag: Flag,
  image: ImageIcon,
  laptop: Laptop,
  link: Link,
  loader: Loader,
  "log-out": LogOut,
  maximize: Maximize,
  "message-square": MessageSquare,
  minimize: Minimize,
  minus: Minus,
  monitor: Monitor,
  moon: Moon,
  "mouse-pointer-2": MousePointer2,
  pause: Pause,
  pencil: Pencil,
  pentagon: Pentagon,
  "pen-tool": PenTool,
  pin: Pin,
  play: Play,
  plus: Plus,
  "redo-2": Redo2,
  rewind: Rewind,
  "rotate-ccw": RotateCcw,
  scissors: Scissors,
  search: Search,
  settings: Settings,
  "share-2": Share2,
  smartphone: Smartphone,
  sparkles: Sparkles,
  spline: Spline,
  square: Square,
  "sticky-note": StickyNote,
  "step-back": StepBack,
  "step-forward": StepForward,
  sun: Sun,
  tablet: Tablet,
  tag: Tag,
  "trash-2": Trash2,
  "triangles-centerline-dashed-horizontal": TrianglesCenterlineDashedHorizontal,
  "triangles-centerline-dashed-vertical": TrianglesCenterlineDashedVertical,
  type: Type,
  "undo-2": Undo2,
  user: User,
  users: Users,
  "volume-2": Volume2,
  "volume-x": VolumeX,
  x: X,
  "zoom-in": ZoomIn,
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
