/**
 * Web fonts, self-hosted through `next/font`. The font files are downloaded
 * once at build time and served from this app's own origin, so no visitor's
 * browser ever contacts Google (no IP address leaves for fonts.googleapis.com
 * or fonts.gstatic.com). All three families are SIL Open Font License 1.1.
 *
 * Each loader exposes its generated family name as a CSS variable; the root
 * layout puts the classes on `<html>`, and `tokens/typography.css` builds the
 * `--font-display` / `--font-sans` / `--font-mono` tokens on top of them.
 * All three are variable fonts, so one file per subset covers every weight the
 * tokens use (400-800).
 */
import { Hanken_Grotesk, JetBrains_Mono, Saira } from "next/font/google";

const saira = Saira({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-saira",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken-grotesk",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

/** Class names that define the font variables; apply once to `<html>`. */
export const fontVariables = [
  saira.variable,
  hankenGrotesk.variable,
  jetbrainsMono.variable,
].join(" ");
