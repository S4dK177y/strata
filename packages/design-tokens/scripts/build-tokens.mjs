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

function renderVars(themeObj, indent = "  ") {
  return Object.entries(themeObj)
    .map(([key, value]) => `${indent}${toCssVarName(key)}: ${value};`)
    .join("\n");
}

const defaultAccent = tokens.accents.emerald;
const swatchVars = Object.entries(tokens.accents)
  .map(([name, cfg]) => `  --strata-swatch-${name}: ${cfg.swatch};`)
  .join("\n");

const nonDefaultAccents = Object.entries(tokens.accents).filter(
  ([name]) => name !== "emerald"
);

const accentOverridesCss = nonDefaultAccents
  .map(([name, cfg]) => {
    return `:root[data-accent="${name}"] {
${renderVars(cfg.light)}
}

@media (prefers-color-scheme: dark) {
  :root:not(.light):not(.dark)[data-accent="${name}"] {
${renderVars(cfg.dark, "    ")}
  }
}

.dark[data-accent="${name}"] {
${renderVars(cfg.dark)}
}`;
  })
  .join("\n\n");

const css = `/* Auto-generated from tokens.json by scripts/build-tokens.mjs. Do not edit manually. */
:root {
  color-scheme: light dark;
${renderVars(tokens.themes.light)}
${renderVars(defaultAccent.light)}
${swatchVars}
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
${renderVars(tokens.themes.dark, "    ")}
${renderVars(defaultAccent.dark, "    ")}
    --strata-shadow-card: ${tokens.shadows.cardDark};
  }
}

.dark {
${renderVars(tokens.themes.dark)}
${renderVars(defaultAccent.dark)}
  --strata-shadow-card: ${tokens.shadows.cardDark};
}

${accentOverridesCss}

.strata-glass {
  background: var(--strata-bg-glass);
  backdrop-filter: blur(18px);
  border: 1px solid var(--strata-border-subtle);
  box-shadow: var(--strata-shadow-card);
}

.strata-aurora-screen {
  position: relative;
  isolation: isolate;
  overflow-x: clip;
  background-color: var(--strata-bg-canvas);
  background-image:
    radial-gradient(62% 55% at 86% 18%, var(--strata-aurora-a) 0%, transparent 65%),
    radial-gradient(58% 60% at 52% 48%, var(--strata-aurora-b) 0%, transparent 68%),
    radial-gradient(65% 55% at 15% 88%, var(--strata-aurora-c) 0%, transparent 70%);
}

.strata-aurora-screen::before,
.strata-aurora-screen::after {
  content: "";
  position: fixed;
  inset: -18%;
  z-index: -1;
  pointer-events: none;
  border-radius: 9999px;
}

.strata-aurora-screen::before {
  background:
    radial-gradient(48% 44% at 78% 22%, var(--strata-aurora-a) 0%, transparent 70%),
    radial-gradient(42% 42% at 24% 76%, var(--strata-aurora-b) 0%, transparent 70%);
}

.strata-aurora-screen::after {
  background:
    radial-gradient(46% 40% at 42% 36%, var(--strata-aurora-c) 0%, transparent 72%),
    radial-gradient(38% 36% at 86% 80%, var(--strata-aurora-a) 0%, transparent 70%);
}

.dark .strata-aurora-screen {
  background-color: var(--strata-bg-canvas);
  background-image:
    radial-gradient(60% 55% at 88% 18%, var(--strata-aurora-a) 0%, transparent 62%),
    radial-gradient(55% 65% at 55% 46%, var(--strata-aurora-b) 0%, transparent 66%),
    radial-gradient(68% 55% at 12% 84%, var(--strata-aurora-c) 0%, transparent 68%);
}

.dark .strata-aurora-screen::before {
  background:
    radial-gradient(48% 44% at 82% 20%, var(--strata-aurora-a) 0%, transparent 68%),
    radial-gradient(44% 42% at 20% 78%, var(--strata-aurora-b) 0%, transparent 68%);
}

.dark .strata-aurora-screen::after {
  background:
    radial-gradient(46% 42% at 46% 42%, var(--strata-aurora-c) 0%, transparent 72%),
    radial-gradient(38% 36% at 84% 76%, var(--strata-aurora-a) 0%, transparent 70%);
}

.strata-aurora-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background-color: var(--strata-auroraHero-surface);
  background-image:
    radial-gradient(75% 95% at 82% 18%, var(--strata-aurora-a) 0%, transparent 65%),
    radial-gradient(65% 90% at 32% 24%, var(--strata-aurora-b) 0%, transparent 65%);
  border: 1px solid var(--strata-border-subtle);
}

.strata-aurora-hero::before {
  content: "";
  position: absolute;
  inset: -25%;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(50% 55% at 80% 24%, var(--strata-aurora-a) 0%, transparent 68%),
    radial-gradient(45% 50% at 28% 35%, var(--strata-aurora-b) 0%, transparent 68%);
}

.dark .strata-aurora-hero {
  background-color: var(--strata-auroraHero-surface);
  background-image:
    linear-gradient(180deg, rgba(11, 12, 14, 0) 68%, var(--strata-bg-canvas) 100%),
    radial-gradient(78% 105% at 84% 16%, var(--strata-aurora-a) 0%, transparent 64%),
    radial-gradient(66% 95% at 44% 34%, var(--strata-aurora-b) 0%, transparent 66%),
    radial-gradient(60% 70% at 10% 10%, var(--strata-aurora-c) 0%, transparent 60%);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.dark .strata-aurora-hero::before {
  background:
    radial-gradient(50% 55% at 82% 20%, var(--strata-aurora-a) 0%, transparent 66%),
    radial-gradient(46% 50% at 30% 40%, var(--strata-aurora-b) 0%, transparent 66%);
}

@keyframes strata-aurora-drift-a {
  0% {
    transform: translate3d(-2%, -1.5%, 0) scale(1);
  }
  50% {
    transform: translate3d(2.5%, 2%, 0) scale(1.06);
  }
  100% {
    transform: translate3d(-1.5%, 3%, 0) scale(0.98);
  }
}

@keyframes strata-aurora-drift-b {
  0% {
    transform: translate3d(2%, 1.5%, 0) scale(1.02);
  }
  50% {
    transform: translate3d(-2.5%, -2%, 0) scale(0.96);
  }
  100% {
    transform: translate3d(1.5%, -2.5%, 0) scale(1.05);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .strata-aurora-screen::before {
    will-change: transform;
    animation: strata-aurora-drift-a 22s ease-in-out infinite alternate;
  }

  .strata-aurora-screen::after {
    will-change: transform;
    animation: strata-aurora-drift-b 28s ease-in-out infinite alternate;
  }

  .strata-aurora-hero::before {
    will-change: transform;
    animation: strata-aurora-drift-a 24s ease-in-out infinite alternate;
  }

  .strata-aurora-screen[data-auth-state="submitting"]::before,
  .strata-aurora-screen[data-auth-state="submitting"]::after {
    animation-duration: 5s;
    filter: brightness(1.18) saturate(1.15);
  }

  .strata-aurora-screen[data-auth-state="entering"]::before {
    transform: translate3d(0, -3%, 0) scale(1.2);
    filter: brightness(1.3) saturate(1.25);
    transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), filter 280ms ease;
  }

  .strata-aurora-screen[data-auth-state="entering"]::after {
    transform: translate3d(0, 3%, 0) scale(1.16);
    filter: brightness(1.25) saturate(1.2);
    transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), filter 280ms ease;
  }
}

.strata-frosted {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid rgba(15, 20, 25, 0.08);
  box-shadow: var(--strata-shadow-card);
}

.dark .strata-frosted {
  background: rgba(11, 14, 18, 0.72);
  backdrop-filter: blur(26px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 24px 56px -20px rgba(0, 0, 0, 0.82);
}

.strata-hero {
  background: var(--strata-hero-bg);
  color: #f8fafc;
  box-shadow: var(--strata-shadow-neon);
}

.dark .strata-hero {
  background: var(--strata-hero-bg);
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
  display: inline-block;
  font-variant-numeric: tabular-nums;
  transition:
    filter 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}

.privacy-blur .strata-money {
  filter: blur(8px);
  opacity: 0.82;
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
  accents: Record<
    "emerald" | "ocean" | "amethyst" | "sunset" | "graphite",
    {
      swatch: string;
      light: Record<string, string>;
      dark: Record<string, string>;
    }
  >;
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
