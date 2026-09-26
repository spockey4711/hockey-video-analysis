import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// The `Heading` primitive is the one place a heading element and the display
// face are styled (P2-8, G1/G15). Anything else would be a hand-rolled copy of
// it that drifts, so both are errors outside the primitive itself. A genuine
// exception (a brand mark, a body-size list title) opts out with an
// `eslint-disable-next-line` comment that says why.
const HEADING_PRIMITIVE = "src/components/core/Heading.tsx";
const handRolledHeadings = [
  {
    selector: "JSXOpeningElement[name.name=/^h[1-6]$/]",
    message:
      "Render headings through `Heading` or `PanelHeader` (@/components/core), not a raw <h1>-<h6>.",
  },
  {
    selector: "Literal[value=/--font-display/]",
    message:
      "The display face belongs to `Heading`; style titles through `Heading` or `PanelHeader`.",
  },
  {
    selector: "TemplateElement[value.raw=/--font-display/]",
    message:
      "The display face belongs to `Heading`; style titles through `Heading` or `PanelHeader`.",
  },
];

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      "import/order": [
        "warn",
        { "newlines-between": "always", alphabetize: { order: "asc" } },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [HEADING_PRIMITIVE, "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...handRolledHeadings],
    },
  },
];

export default config;
