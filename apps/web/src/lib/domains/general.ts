import type { Domain } from '@you-design/shared';

export interface DomainTemplate {
  id: Domain;
  label: string;
  description: string;
  designerAddendum: string;
  criticRules: string;
  exampleStructure: string;
}

export const generalDomain: DomainTemplate = {
  id: 'general',
  label: 'General',
  description: 'No specific industry — works for any landing or marketing page.',
  designerAddendum: `No special domain rules. Apply universal best practices:
- Clear hierarchy: one H1 per page, sensible H2/H3 nesting
- Single primary CTA above the fold
- Footer with at least basic contact / legal links`,
  criticRules: `No domain-specific rules beyond the universal checks.`,
  exampleStructure: `<header> with nav + logo
<main>
  <section> hero with H1 + subhead + primary CTA
  <section> features (2-4 cards)
  <section> social proof or testimonials
  <section> secondary CTA
</main>
<footer>`,
};
