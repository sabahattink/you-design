import type { Domain } from '@you-design/shared';
import { generalDomain, type DomainTemplate } from './general';
import { saasLandingDomain } from './saas-landing';
import { ecommerceProductDomain } from './ecommerce-product';
import { healthcareAppointmentDomain } from './healthcare-appointment';

export type { DomainTemplate };

export const DOMAINS: Record<Domain, DomainTemplate> = {
  general: generalDomain,
  'saas-landing': saasLandingDomain,
  'ecommerce-product': ecommerceProductDomain,
  'healthcare-appointment': healthcareAppointmentDomain,
};

export function getDomain(id: Domain | string): DomainTemplate {
  return DOMAINS[id as Domain] ?? DOMAINS.general;
}
