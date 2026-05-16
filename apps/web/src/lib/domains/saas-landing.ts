import type { DomainTemplate } from './general';

export const saasLandingDomain: DomainTemplate = {
  id: 'saas-landing',
  label: 'SaaS landing',
  description: 'A marketing page for a software product. Target: trial signups / demo bookings.',
  designerAddendum: `SaaS LANDING RULES:
- Hero must include: clear value proposition (what + for whom + outcome), primary CTA (verb + benefit, not "Learn more"), supporting line that quantifies the value
- Include a 3-feature row with concrete benefits, not vague adjectives
- Add a social-proof block (logo wall, testimonial with name + role, or a usage stat)
- Pricing or "Start free" CTA appears at least twice (hero + after features)
- No "Welcome!" headlines. No "We are passionate about X." copy.
- Footer: contact, status, terms, privacy at minimum`,
  criticRules: `SaaS-SPECIFIC CHECKS:
- Critical if: hero CTA is generic ("Get started" alone is weak; "Start free trial" is better), no social proof anywhere on page, primary action is below the fold
- Warning if: headlines describe features instead of outcomes, more than 3 competing CTAs in the same section, pricing is hidden (no link/CTA leading there)
- Info if: missing "no credit card required" reassurance near signup, footer lacks status/changelog link`,
  exampleStructure: `<header> nav with logo + product + pricing + login + primary "Start free" CTA
<main>
  <section> hero: <h1>outcome-first headline</h1> + subhead with proof point + <a>Start free trial</a> + secondary "Watch demo"
  <section> social proof: logos OR named testimonial OR stat
  <section> features: 3 cards (icon + bold benefit + concrete description)
  <section> deeper feature highlight with visual
  <section> pricing teaser OR "Start free" repeat CTA
</main>
<footer>`,
};
