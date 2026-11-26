---
name: strata-ui
description: Design system and UI authoring rules for Strata (Expressive Neobank style, semantic design tokens, Privacy Blur, tabular-nums, and Light/Dark support). Read before creating or modifying any UI component.
---

# Strata UI Skill

Always read `docs/DESIGN_SYSTEM.md` and `packages/design-tokens/tokens.json` before authoring UI.

## Checklist
1. **Tokens only:** Use semantic CSS custom properties (`--strata-bg-canvas`, `--strata-bg-surface`, `--strata-bg-glass`, `--strata-border-subtle`, `--strata-text-primary`, `--strata-text-muted`, `--strata-accent-brand`, `--strata-money-income`, `--strata-money-expense`, `--strata-radar-warn`, etc.). Never hardcode hex values or raw Tailwind gray/slate colors in `apps/web/src/components/` or `apps/web/src/app/`.
2. **Expressive Neobank Aesthetic (Graphite + Aurora + Frosted Squircles):**
   - Pure carbon-graphite matte section cards (`rounded-3xl`, `bg-[var(--strata-bg-surface)]`) with nested `rounded-2xl` elevated tiles (`bg-[var(--strata-bg-elevated)]`) rather than heavy nested borders.
   - Use `.strata-aurora-screen` / `.strata-aurora-hero` for open atmospheric emerald-cyan-indigo gradients and `.strata-frosted` for translucent squircle cards/quick-actions over aurora backdrops.
   - Both **Light** and **Dark** themes must have crisp WCAG AA contrast.
3. **Money Display:**
   - Always use `AmountText` / `.strata-money` (`font-variant-numeric: tabular-nums`) so numbers align cleanly, render split-decimal muted fractions (e.g. `,67 ₽` at 55% opacity), and automatically obey the global `.privacy-blur` toggle.
4. **Mobile-first PWA:**
   - Minimum `44px` touch targets, comfortable bottom navigation on mobile (`Overview`, `Operations`, `+`, `Capital`, `Plans`), collapsible sidebar on desktop (`>= lg`).
5. **i18n:**
   - Every visible label, aria-label, and toast must exist in both `src/messages/ru.json` and `src/messages/en.json`.
6. **Proven UI Libraries & Anti-AI-Cliché Iconography:**
   - Use popular, well-maintained, `npm audit`-clean accessible UI libraries (`Radix UI` / `shadcn/ui` primitives, `lucide-react`, `vaul`, `sonner`, `recharts`, `motion`) wrapped in `apps/web/src/components/ui/` and styled via `--strata-*` tokens instead of hand-rolling dialogs, drawers, selects, popovers, toasts, or charts from scratch.
   - Never use raw Unicode emojis in UI controls, navigation, badges, or headings — always use crisp `lucide-react` vector icons (`strokeWidth={1.75}`).
   - Never use `Sparkles` icons or decorative glowing icon boxes above card/section headings. Keep service icons strictly monochrome (`text-[var(--strata-text-muted)]` / `text-[var(--strata-text-secondary)]`), reserving color exclusively for the primary CTA and semantic financial indicators (income/expense/promo radar).
   - Keep UI copy concise, human, and product-oriented (never expose technical jargon like "integer precision" or internal milestone terms in user-facing copy).
