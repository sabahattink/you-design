import type { DomainTemplate } from './general';

export const healthcareAppointmentDomain: DomainTemplate = {
  id: 'healthcare-appointment',
  label: 'Healthcare appointment',
  description: 'A medical appointment booking page. Conservative tone, accessibility critical.',
  designerAddendum: `HEALTHCARE APPOINTMENT RULES:
- Tone: calm, reassuring, factual. NEVER playful, urgent, or sales-y.
- WCAG AA contrast is mandatory (4.5:1 minimum on body text, 3:1 on large text and UI components)
- Every form field has a visible <label> (placeholder-as-label is forbidden)
- Required fields are marked with text "(required)" — not just a red asterisk
- A clear privacy notice near the appointment form: what data is collected, why, retention, contact for deletion
- An accessible date/time picker hint (do not assume drag interaction works)
- Emergency disclaimer in footer: "If this is a medical emergency, call [number]"
- No "Welcome to YourHealth!" — "Book a consultation" or "Schedule your visit" instead
- Colors: avoid pure red except for emergencies; avoid pure green for "success" (color-blindness)`,
  criticRules: `HEALTHCARE-SPECIFIC CHECKS:
- Critical if: privacy notice is missing, form fields lack visible labels, contrast appears below AA on any text (estimate from inline classes), no emergency disclaimer in footer, marketing-style hero copy
- Warning if: language is overly clinical jargon, no accessibility statement link, no clear cancellation/reschedule policy, missing language/translation cue if site is single-language
- Info if: missing pre-visit info (what to bring, parking), missing telehealth alternative mention`,
  exampleStructure: `<header> with org name + nav + phone number (large, tap-friendly)
<main>
  <section> hero: <h1>Schedule your visit</h1> + supportive subhead, NOT "Welcome!"
  <section> form: name, contact, preferred date/time, reason — every field labeled, required marked in text
  <section> privacy notice block (concise, plain language)
  <section> what to expect (preparation, duration, telehealth option)
</main>
<footer> emergency disclaimer + accessibility statement link + contact + policies`,
};
