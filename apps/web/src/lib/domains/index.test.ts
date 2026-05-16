import { describe, it, expect } from 'vitest';
import { DOMAINS, getDomain } from './index.js';

describe('domains registry', () => {
  it('has all 4 domains', () => {
    expect(Object.keys(DOMAINS).sort()).toEqual([
      'ecommerce-product',
      'general',
      'healthcare-appointment',
      'saas-landing',
    ]);
  });

  it('getDomain returns template for known id', () => {
    const d = getDomain('saas-landing');
    expect(d.label).toBe('SaaS landing');
    expect(d.designerAddendum).toContain('SaaS LANDING RULES');
  });

  it('getDomain falls back to general for unknown id', () => {
    const d = getDomain('unknown' as never);
    expect(d.id).toBe('general');
  });
});
