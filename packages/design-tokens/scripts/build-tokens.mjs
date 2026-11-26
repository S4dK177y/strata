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
  backdrop-filter: blur(18px);
  border: 1px solid var(--strata-border-subtle);
  box-shadow: var(--strata-shadow-card);
}

.strata-aurora-screen {
  background-color: var(--strata-bg-canvas);
  background-image:
    radial-gradient(62% 55% at 86% 18%, rgba(16, 185, 129, 0.22) 0%, transparent 65%),
    radial-gradient(58% 60% at 52% 48%, rgba(6, 182, 212, 0.18) 0%, transparent 68%),
    radial-gradient(65% 55% at 15% 88%, rgba(99, 102, 241, 0.12) 0%, transparent 70%);
}

.dark .strata-aurora-screen {
  background-color: var(--strata-bg-canvas);
  background-image:
    radial-gradient(60% 55% at 88% 18%, rgba(52, 211, 153, 0.36) 0%, transparent 62%),
    radial-gradient(55% 65% at 55% 46%, rgba(14, 165, 233, 0.30) 0%, transparent 66%),
    radial-gradient(68% 55% at 12% 84%, rgba(16, 185, 129, 0.24) 0%, transparent 68%),
    linear-gradient(135deg, #0b0c0e 0%, #111b1e 48%, #0d1615 100%);
}

.strata-aurora-hero {
  background-color: var(--strata-bg-surface);
  background-image:
    radial-gradient(75% 95% at 82% 18%, rgba(16, 185, 129, 0.20) 0%, transparent 65%),
    radial-gradient(65% 90% at 32% 24%, rgba(6, 182, 212, 0.16) 0%, transparent 65%);
  border: 1px solid var(--strata-border-subtle);
}

.dark .strata-aurora-hero {
  background-color: #0e1416;
  background-image:
    linear-gradient(180deg, rgba(11, 12, 14, 0) 68%, var(--strata-bg-canvas) 100%),
    radial-gradient(78% 105% at 84% 16%, rgba(52, 211, 153, 0.38) 0%, transparent 64%),
    radial-gradient(66% 95% at 44% 34%, rgba(14, 165, 233, 0.28) 0%, transparent 66%),
    radial-gradient(60% 70% at 10% 10%, rgba(16, 185, 129, 0.18) 0%, transparent 60%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.strata-frosted {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(22px);
  border: 1px solid rgba(15, 20, 25, 0.08);
  box-shadow: var(--strata-shadow-card);
}

.dark .strata-frosted {
  background: rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 20px 48px -24px rgba(0, 0, 0, 0.7);
}

.strata-hero {
  background: linear-gradient(135deg, #047857 0%, #0d9488 55%, #0284c7 100%);
  color: #f8fafc;
  box-shadow: var(--strata-shadow-neon);
}

.dark .strata-hero {
  background:
    radial-gradient(120% 140% at 85% 0%, rgba(52, 211, 153, 0.28) 0%, rgba(14, 165, 233, 0.20) 52%, rgba(22, 23, 26, 0.96) 100%);
  border: 1px solid var(--strata-border-strong);
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
