/**
 * The board as a picture (S7): the step on show, drawn as the players see it
 * on the collection link, as a PNG in a shape a team chat shows well. It is
 * made entirely in the browser: the picture's own SVG (`BoardImage`) is drawn
 * in the page, so it takes the board's colours and fonts, then copied into a
 * self-contained SVG and painted onto a canvas at full size. On a phone the
 * PNG goes to the share sheet (WhatsApp and the like), elsewhere it downloads.
 */
import { downloadBlob } from "@/features/player/telestration/export";

/** The picture's shapes: wide as a video, the classic photo, or square. */
export const IMAGE_PRESETS = ["wide", "standard", "square"] as const;
export type ImagePreset = (typeof IMAGE_PRESETS)[number];

/** Each shape's size in image pixels, all as wide as a full-HD video. */
export const IMAGE_SIZE: Record<
  ImagePreset,
  { readonly width: number; readonly height: number }
> = {
  wide: { width: 1920, height: 1080 },
  standard: { width: 1920, height: 1440 },
  square: { width: 1920, height: 1920 },
};

/**
 * Image pixels per screen pixel. The picture is the board as it looks about
 * 960 pixels wide on screen, drawn at twice the density, so what the board
 * sizes in screen pixels (the pitch lines, the smallest label) keeps its
 * weight against the rest of the drawing.
 */
export const IMAGE_DENSITY = 2;

/** A picture's pixel size and the part of the board, in view metres, it shows. */
export interface ImageFrame {
  readonly width: number;
  readonly height: number;
  /** The SVG view box: the board centred, with room round it to fill the shape. */
  readonly viewBox: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  /** Image pixels per metre. */
  readonly pxPerMetre: number;
}

/**
 * Fit a board of `view` metres into a picture of `preset`'s shape, centred,
 * as large as it goes. The room left over on two sides is part of the view
 * box, so the run-off colour fills it.
 */
export function imageFrame(
  view: { readonly width: number; readonly height: number },
  preset: ImagePreset,
): ImageFrame {
  const { width, height } = IMAGE_SIZE[preset];
  const pxPerMetre = Math.min(width / view.width, height / view.height);
  const boxWidth = width / pxPerMetre;
  const boxHeight = height / pxPerMetre;
  return {
    width,
    height,
    viewBox: {
      x: (view.width - boxWidth) / 2,
      y: (view.height - boxHeight) / 2,
      width: boxWidth,
      height: boxHeight,
    },
    pxPerMetre,
  };
}

const UMLAUTS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
};

/**
 * The picture's file name: the scene's name and the step, e.g. `Ecke kurz
 * Variante 2` on step 3 -> `ecke-kurz-variante-2-schritt-3.png`. Umlauts are
 * spelled out and anything else but letters and digits becomes one hyphen, so
 * the name is safe on every file system. It never carries an id or a link.
 */
export function boardImageName(name: string, step: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[äöüß]/g, (letter) => UMLAUTS[letter] ?? "")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  const at = step === 0 ? "start" : `schritt-${step}`;
  return `${slug || "taktiktafel"}-${at}.png`;
}

/**
 * The paint an element of the picture takes from the page's stylesheets
 * (Tailwind classes over theme tokens), which a standalone SVG cannot see.
 */
const PAINT = ["fill", "stroke", "font-family", "font-weight"] as const;

/** A CSS `font-family` list as bare family names. */
export function fontFamilies(list: string): string[] {
  return list
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** Every rule of a stylesheet, nested ones (`@layer`, `@media`) included. */
function* allRules(rules: CSSRuleList): Generator<CSSRule> {
  for (const rule of Array.from(rules)) {
    yield rule;
    if ("cssRules" in rule && rule.cssRules instanceof CSSRuleList) {
      yield* allRules(rule.cssRules);
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * The page's `@font-face` rules for `families`, with each font file inlined
 * as a data URL: a picture drawn from an SVG loads nothing from outside, so
 * the app font would otherwise fall back to a system one. A font that cannot
 * be read is left out and the picture falls back for it.
 */
async function embeddedFonts(families: ReadonlySet<string>): Promise<string> {
  const faces: { css: string; base: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // A stylesheet from another origin cannot be read.
      continue;
    }
    for (const rule of allRules(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const [family] = fontFamilies(rule.style.getPropertyValue("font-family"));
      if (family && families.has(family)) {
        faces.push({ css: rule.cssText, base: sheet.href ?? location.href });
      }
    }
  }
  const inlined = await Promise.all(
    faces.map(({ css, base }) => inlineFontFace(css, base)),
  );
  return inlined.filter(Boolean).join("\n");
}

/**
 * One `@font-face` rule with each font file it names fetched (relative to
 * `base`) and inlined as a data URL, or `""` when a file cannot be had.
 */
export async function inlineFontFace(
  css: string,
  base: string,
): Promise<string> {
  let out = css;
  for (const [whole, url] of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    if (!url || url.startsWith("data:")) continue;
    try {
      const response = await fetch(new URL(url, base));
      if (!response.ok) return "";
      const data = await blobToDataUrl(await response.blob());
      out = out.replace(whole, `url("${data}")`);
    } catch {
      return "";
    }
  }
  return out;
}

/**
 * A copy of the picture's SVG that stands on its own: the paint each element
 * takes from the page written onto it, and its fonts inlined.
 */
export async function standaloneSvg(svg: SVGSVGElement): Promise<string> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...Array.from(svg.querySelectorAll<SVGElement>("*"))];
  const copies = [copy, ...Array.from(copy.querySelectorAll<SVGElement>("*"))];
  const families = new Set<string>();
  originals.forEach((original, index) => {
    const element = copies[index];
    if (!element) return;
    const computed = getComputedStyle(original);
    for (const property of PAINT) {
      const value = computed.getPropertyValue(property);
      if (value) element.style.setProperty(property, value);
    }
    element.removeAttribute("class");
    if (original.localName === "text") {
      for (const family of fontFamilies(computed.fontFamily)) {
        families.add(family);
      }
    }
  });
  const fonts = families.size > 0 ? await embeddedFonts(families) : "";
  if (fonts) {
    const style = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "style",
    );
    style.textContent = fonts;
    copy.prepend(style);
  }
  return new XMLSerializer().serializeToString(copy);
}

/** Why a picture could not be made; the dialog says so and offers no file. */
export class BoardImageFailure extends Error {
  constructor(cause?: unknown) {
    super("The board picture could not be drawn", { cause });
    this.name = "BoardImageFailure";
  }
}

/**
 * Draw the picture's SVG as a PNG of `width` x `height` pixels. Rejects with
 * a {@link BoardImageFailure} when the browser cannot draw or encode it.
 */
export async function renderBoardImage(
  svg: SVGSVGElement,
  width: number,
  height: number,
): Promise<Blob> {
  const markup = await standaloneSvg(svg);
  const url = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const picture = new Image(width, height);
    picture.src = url;
    await picture.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new BoardImageFailure();
    ctx.drawImage(picture, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new BoardImageFailure());
      }, "image/png");
    });
  } catch (error) {
    throw error instanceof BoardImageFailure
      ? error
      : new BoardImageFailure(error);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** What the browser offers for the picture: a phone's share sheet or a download. */
export type ImageHandOff = "share" | "download";

/**
 * Share on a phone that can share files, download everywhere else. A laptop
 * may offer a share sheet too, but there the coach wants the file.
 */
export function imageHandOff(
  file: File,
  nav: Pick<Navigator, "canShare"> | undefined,
  phone: boolean,
): ImageHandOff {
  if (!phone || typeof nav?.canShare !== "function") return "download";
  try {
    return nav.canShare({ files: [file] }) ? "share" : "download";
  } catch {
    return "download";
  }
}

/** Whether the screen is driven by a finger, the mark of a phone or tablet. */
export function isTouchScreen(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/** What became of a hand-off: the sheet took it, it downloaded, or the coach cancelled. */
export type HandOffResult = "shared" | "downloaded" | "cancelled";

/**
 * Hand the picture to the share sheet, or download it. A share the coach
 * cancels ends there; a share the browser refuses (no user gesture left, no
 * share target) downloads the file instead.
 */
export async function handOffImage(
  file: File,
  how: ImageHandOff,
  nav: Pick<Navigator, "share"> = navigator,
): Promise<HandOffResult> {
  if (how === "share") {
    try {
      await nav.share({ files: [file] });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  downloadBlob(file, file.name);
  return "downloaded";
}
