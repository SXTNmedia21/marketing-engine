import { describe, it, expect } from 'vitest';
import { renderTemplateA, renderTemplateB } from '../src/index.js';
import type { LpConfig } from '@me/lp-config';
import type { RenderOptions } from '../src/index.js';

const OPTS: RenderOptions = {
  request_id: 'req_test_001',
  visitor_id: 'vis_abc123',
  events_endpoint: 'https://events.example.com/events',
  form_endpoint: 'https://form.example.com/submit',
};

function makeConfig(overrides: Partial<LpConfig> = {}): LpConfig {
  return {
    slug: 'test-lp',
    template: 'template_a_lead_capture',
    version: 1,
    status: 'active',
    theme: { primary: '#0F172A', background: '#FFFFFF', text: '#111827' },
    hero: {
      headline: 'Test Headline',
      subheadline: 'A compelling subheadline',
    },
    bullets: ['Benefit one', 'Benefit two'],
    form: {
      fields: [
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'name', label: 'Name', type: 'text', required: false },
      ],
      submit_label: 'Get started',
      success_message: 'Thank you!',
    },
    pixels: {},
    tracking: {
      campaign_id: '550e8400-e29b-41d4-a716-446655440000',
      utm_source: 'meta',
    },
    ...overrides,
  } as LpConfig;
}

describe('renderTemplateA', () => {
  it('renders to a string with doctype and html tags', () => {
    const html = renderTemplateA(makeConfig(), OPTS);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('includes the headline', () => {
    const html = renderTemplateA(makeConfig({ hero: { headline: 'My Great Offer' } }), OPTS);
    expect(html).toContain('My Great Offer');
  });

  it('includes the slug as data attribute', () => {
    const html = renderTemplateA(makeConfig({ slug: 'my-test-slug' }), OPTS);
    expect(html).toContain('data-slug="my-test-slug"');
  });

  it('renders all form fields', () => {
    const html = renderTemplateA(makeConfig(), OPTS);
    // 2 fields: email + name
    expect(html).toContain('name="email"');
    expect(html).toContain('name="name"');
    expect(html).toContain('Get started');
  });

  it('renders bullets when present', () => {
    const html = renderTemplateA(makeConfig(), OPTS);
    expect(html).toContain('Benefit one');
    expect(html).toContain('Benefit two');
  });

  it('omits bullet list when bullets is empty', () => {
    const html = renderTemplateA(makeConfig({ bullets: [] }), OPTS);
    expect(html).not.toContain('<ul>');
  });

  it('includes tracking script', () => {
    const html = renderTemplateA(makeConfig(), OPTS);
    expect(html).toContain('<script>');
    expect(html).toContain('window.__ME__');
  });

  it('has no inline event handler attributes (CSP-safe)', () => {
    const html = renderTemplateA(makeConfig(), OPTS);
    expect(html).not.toMatch(/\bon\w+\s*=/i);
  });

  it('escapes HTML in headline', () => {
    const html = renderTemplateA(
      makeConfig({ hero: { headline: '<script>alert(1)</script>' } }),
      OPTS,
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('snapshot matches for fixture config', () => {
    const html = renderTemplateA(makeConfig(), OPTS);
    expect(html).toMatchSnapshot();
  });
});

describe('renderTemplateB', () => {
  it('renders to a string with doctype and html tags', () => {
    const html = renderTemplateB(makeConfig({ template: 'template_b_long_form' }), OPTS);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('includes the headline', () => {
    const html = renderTemplateB(
      makeConfig({ template: 'template_b_long_form', hero: { headline: 'Long Form Offer' } }),
      OPTS,
    );
    expect(html).toContain('Long Form Offer');
  });

  it('renders video section when video_url provided', () => {
    const html = renderTemplateB(
      makeConfig({
        template: 'template_b_long_form',
        hero: { headline: 'Test', video_url: 'https://video.example.com/v.mp4' },
      }),
      OPTS,
    );
    expect(html).toContain('<video');
    expect(html).toContain('https://video.example.com/v.mp4');
  });

  it('renders form with correct field count', () => {
    const html = renderTemplateB(makeConfig({ template: 'template_b_long_form' }), OPTS);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="name"');
  });

  it('has no inline event handler attributes (CSP-safe)', () => {
    const html = renderTemplateB(makeConfig({ template: 'template_b_long_form' }), OPTS);
    expect(html).not.toMatch(/\bon\w+\s*=/i);
  });

  it('includes tracking script', () => {
    const html = renderTemplateB(makeConfig({ template: 'template_b_long_form' }), OPTS);
    expect(html).toContain('<script>');
    expect(html).toContain('window.__ME__');
  });

  it('snapshot matches for fixture config', () => {
    const html = renderTemplateB(makeConfig({ template: 'template_b_long_form' }), OPTS);
    expect(html).toMatchSnapshot();
  });
});
