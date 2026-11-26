# Strata — Unified Design System ("Expressive Neobank")

## Core Aesthetic
**Expressive Neobank**: deep obsidian canvas in dark mode (`#070913`) and airy cool mist in light mode (`#F3F5FB`), paired with subtle translucent surfaces, crisp indigo→cyan→emerald neon gradients, smooth `150–250ms` transitions, and strict `tabular-nums` alignment for all financial figures.

## 3-Layer Enforcement
1. **`packages/design-tokens/tokens.json`**: Single source of truth for Light & Dark semantic tokens, radii, and shadows. Run `npm run build:tokens` after any token edit.
2. **Semantic CSS Variables (`@strata/design-tokens/dist/tokens.css`)**:
   - Surfaces: `--strata-bg-canvas`, `--strata-bg-surface`, `--strata-bg-elevated`, `--strata-bg-glass`
   - Borders: `--strata-border-subtle`, `--strata-border-strong`, `--strata-border-glow`
   - Text: `--strata-text-primary`, `--strata-text-secondary`, `--strata-text-muted`
   - Accents: `--strata-accent-brand`, `--strata-accent-secondary`, `--strata-accent-neon`
   - Semantic Finance: `--strata-money-income`, `--strata-money-expense`, `--strata-money-compensation`, `--strata-radar-ok`, `--strata-radar-warn`, `--strata-radar-expired`, `--strata-debt-lent`, `--strata-debt-borrowed`, `--strata-goal-envelope`
   - Stories Ring: `--strata-story-ring-start`, `--strata-story-ring-mid`, `--strata-story-ring-end`
3. **Canonical Rules for Agents & Contributors**:
   - NEVER use raw hex codes or default Tailwind color scales (`gray-*`, `slate-*`, `indigo-*`) in feature components once UI primitives are wired; reference CSS tokens via utilities or helper classes (`.strata-hero`, `.strata-glass`, `.strata-money`).
   - Every monetary output MUST carry the `.strata-money` class so `tabular-nums` and global `.privacy-blur` work uniformly across the entire app.
   - Brand icon is `packages/design-tokens/assets/strata-icon.svg` (3 floating isometric neon-emerald/cyan/indigo layers).
