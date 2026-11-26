import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const tokensPath = path.join(rootDir, "tokens.json");
const distDir = path.join(rootDir, "dist");

const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
fs.mkdirSync(distDir, { recursive: true });

function toCssVarName(key) {
  return `--strata-${key.replace(/\./g, "-")}`;
}

function renderVars(themeObj) {
  return Object.entries(themeObj)
    .map(([key, value]) => `  ${toCssVarName(key)}: ${value};`)
    .join("\n");
}

const css = `/* Auto-generated from tokens.json by scripts/build-tokens.mjs. Do not edit manually. */
:root {
  color-scheme: light dark;
${renderVars(tokens.themes.light)}
  --strata-radius-card: ${tokens.radii.card};
  --strata-radius-hero: ${tokens.radii.hero};
  --strata-radius-pill: ${tokens.radii.pill};
  --strata-shadow-card: ${tokens.shadows.cardLight};
  --strata-shadow-neon: ${tokens.shadows.neonGlow};
}

:root:has(> head > meta[name="color-scheme"][content="dark"]) {
  color-scheme: dark;
}

:root:has(> head > meta[name="color-scheme"][content="light"]) {
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not(.light):not(.dark) {
${renderVars(tokens.themes.dark)
  .split("\n")
  .map((line) => `  ${line}`)
  .join("\n")}
    --strata-shadow-card: ${tokens.shadows.cardDark};
  }
}

.dark {
${renderVars(tokens.themes.dark)}
  --strata-shadow-card: ${tokens.shadows.cardDark};
}

.strata-glass {
  background: var(--strata-bg-glass);
  backdrop-filter: blur(14px);
  border: 1px solid var(--strata-border-subtle);
  box-shadow: var(--strata-shadow-card);
}

.strata-hero {
  background: linear-gradient(135deg, #312e81 0%, #4338ca 48%, #0f766e 100%);
  color: #f8fafc;
  box-shadow: var(--strata-shadow-neon);
}

.dark .strata-hero {
  background:
    radial-gradient(120% 140% at 0% 0%, rgba(99, 102, 241, 0.34) 0%, rgba(16, 185, 129, 0.16) 55%, rgba(14, 18, 36, 0.96) 100%);
  border: 1px solid var(--strata-border-glow);
}

.strata-story-ring {
  background: linear-gradient(
    135deg,
    var(--strata-story-ring-start),
    var(--strata-story-ring-mid),
    var(--strata-story-ring-end)
  );
}

.strata-money {
  font-variant-numeric: tabular-nums;
  transition: filter 180ms ease;
}

.privacy-blur .strata-money {
  filter: blur(7px);
  user-select: none;
}
`;

fs.writeFileSync(path.join(distDir, "tokens.css"), css, "utf8");

const js = `// Auto-generated from tokens.json
export const strataTokens = ${JSON.stringify(tokens, null, 2)};
`;
fs.writeFileSync(path.join(distDir, "tokens.js"), js, "utf8");

const dts = `export interface StrataThemeTokens {
${Object.keys(tokens.themes.light)
  .map((k) => `  "${k}": string;`)
  .join("\n")}
}

export declare const strataTokens: {
  brand: string;
  style: string;
  themes: {
    light: StrataThemeTokens;
    dark: StrataThemeTokens;
  };
  radii: {
    card: string;
    hero: string;
    pill: string;
  };
  shadows: {
    cardLight: string;
    cardDark: string;
    neonGlow: string;
  };
};
`;
fs.writeFileSync(path.join(distDir, "tokens.d.ts"), dts, "utf8");

function hexToComposeColor(value) {
  if (!value.startsWith("#")) return null;
  const hex = value.slice(1);
  if (hex.length === 6) return `0xFF${hex.toUpperCase()}`;
  return null;
}

function toKotlinName(key) {
  return key
    .split(".")
    .map((p, idx) => (idx === 0 ? p : p[0].toUpperCase() + p.slice(1)))
    .join("");
}

const kotlinDarkLines = Object.entries(tokens.themes.dark)
  .map(([k, v]) => {
    const c = hexToComposeColor(v);
    return c ? `    val ${toKotlinName(k)} = ${c}` : null;
  })
  .filter(Boolean)
  .join("\n");

const kotlin = `// Auto-generated from tokens.json for future Android Jetpack Compose client
package app.strata.design.tokens

object StrataDarkHex {
${kotlinDarkLines}
}
`;
fs.writeFileSync(path.join(distDir, "StrataTokens.kt"), kotlin, "utf8");

console.log("Built @strata/design-tokens -> dist/{tokens.css,tokens.js,tokens.d.ts,StrataTokens.kt}");
