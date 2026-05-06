import type { LpConfig, TemplateId } from '@me/lp-config';
import { renderTemplateA } from './template-a.js';
import { renderTemplateB } from './template-b.js';

export type TemplateRenderer = (config: LpConfig, opts: RenderOptions) => string;

export interface RenderOptions {
  request_id: string;
  visitor_id: string;
  events_endpoint: string;
  form_endpoint: string;
}

const RENDERERS: Record<TemplateId, TemplateRenderer> = {
  template_a_lead_capture: renderTemplateA,
  template_b_long_form: renderTemplateB,
};

export function renderLp(config: LpConfig, opts: RenderOptions): string {
  const renderer = RENDERERS[config.template];
  if (!renderer) {
    throw new Error(`Unknown template: ${config.template}`);
  }
  return renderer(config, opts);
}

export { renderTemplateA, renderTemplateB };
