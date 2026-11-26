---
name: strata-ui
description: Design system and UI authoring rules for Strata (Expressive Neobank style, semantic design tokens, Privacy Blur, tabular-nums, and Light/Dark support). Read before creating or modifying any UI component.
---

# Strata UI Skill

Always read `docs/DESIGN_SYSTEM.md` and `packages/design-tokens/tokens.json` before authoring UI.

## Checklist
1. **Tokens only:** Use semantic CSS custom properties (`--strata-bg-canvas`, `--strata-bg-surface`, `--strata-bg-glass`, `--strata-border-subtle`, `--strata-text-primary`, `--strata-text-muted`, `--strata-accent-brand`, `--strata-money-income`, `--strata-money-expense`, `--strata-radar-warn`, etc.). Never hardcode hex values or raw Tailwind gray/slate colors in `apps/web/src/components/` or `apps/web/src/app/`.
2. **Expressive Neobank Aesthetic:**
   - Rounded surfaces (`rounded-2xl` / `rounded-3xl`), subtle glass borders, soft neon-gradient hero accents, micro-animations (`150–250ms cubic-bezier(0.22, 1, 0.36, 1)`).
   - Both **Light** and **Dark** themes must have crisp WCAG AA contrast.
3. **Money Display:**
   - Always apply `.strata-money` (`font-variant-numeric: tabular-nums`) so numbers align cleanly and automatically obey the global `.privacy-blur` toggle.
4. **Mobile-first PWA:**
   - Minimum `44px` touch targets, comfortable bottom navigation on mobile (`Overview`, `Operations`, `+`, `Capital`, `Plans`), collapsible sidebar on desktop (`>= lg`).
5. **i18n:**
   - Every visible label, aria-label, and toast must exist in both `src/messages/ru.json` and `src/messages/en.json`.
6. **Proven UI Libraries:**
   - Use popular, well-maintained, `npm audit`-clean accessible UI libraries (`Radix UI` / `shadcn/ui` primitives, `lucide-react`, `vaul`, `sonner`, `recharts`, `motion`) wrapped in `apps/web/src/components/ui/` and styled via `--strata-*` tokens instead of hand-rolling dialogs, drawers, selects, popovers, toasts, or charts from scratch.
