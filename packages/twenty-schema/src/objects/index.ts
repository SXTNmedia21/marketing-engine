import type { ObjectDef } from '../types.js';
import { Campaign } from './campaign.js';
import { LandingPage } from './landing-page.js';
import { Ad } from './ad.js';
import { PixelAccount } from './pixel-account.js';
import { LeadAttribution } from './lead-attribution.js';

export { Campaign, LandingPage, Ad, PixelAccount, LeadAttribution };

/**
 * Order matters — relations require target object to exist first.
 * Seed runs in this order, then back-fills relations.
 */
export const ALL_OBJECTS: ObjectDef[] = [
  Campaign,
  LandingPage,
  Ad,
  PixelAccount,
  LeadAttribution,
];
