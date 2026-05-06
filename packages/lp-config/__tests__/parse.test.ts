import { describe, it, expect } from 'vitest';
import { parseLpConfig, safeParseLpConfig } from '../src/index.js';

const BASE: Parameters<typeof parseLpConfig>[0] = {
  slug: 'my-lp',
  template: 'template_a_lead_capture',
  theme: { primary: '#0F172A', background: '#FFFFFF', text: '#111827' },
  hero: { headline: 'Test headline' },
  form: {
    fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
    submit_label: 'Submit',
    success_message: 'Thank you!',
  },
  tracking: { campaign_id: '550e8400-e29b-41d4-a716-446655440000' },
};

describe('parseLpConfig accepts valid config', () => {
  it('parses a minimal valid config', () => {
    const result = parseLpConfig(BASE);
    expect(result.slug).toBe('my-lp');
    expect(result.status).toBe('draft');
    expect(result.version).toBe(1);
    expect(result.bullets).toEqual([]);
    expect(result.pixels).toEqual({});
  });

  it('accepts both template IDs', () => {
    const a = parseLpConfig({ ...BASE, template: 'template_a_lead_capture' });
    expect(a.template).toBe('template_a_lead_capture');

    const b = parseLpConfig({ ...BASE, template: 'template_b_long_form' });
    expect(b.template).toBe('template_b_long_form');
  });

  it('accepts all valid status values', () => {
    for (const status of ['draft', 'active', 'paused', 'deleted'] as const) {
      const r = parseLpConfig({ ...BASE, status });
      expect(r.status).toBe(status);
    }
  });

  it('accepts up to 6 bullets', () => {
    const bullets = ['a', 'b', 'c', 'd', 'e', 'f'];
    const r = parseLpConfig({ ...BASE, bullets });
    expect(r.bullets).toHaveLength(6);
  });

  it('accepts a form with 8 fields', () => {
    const fields = Array.from({ length: 8 }, (_, i) => ({
      name: `f${i}`,
      label: `Field ${i}`,
      type: 'text' as const,
      required: false,
    }));
    const r = parseLpConfig({ ...BASE, form: { ...BASE.form as object, fields } as never });
    expect((r.form.fields as unknown[]).length).toBe(8);
  });
});

describe('parseLpConfig rejects invalid configs', () => {
  it('rejects slug with uppercase letters', () => {
    expect(() => parseLpConfig({ ...BASE, slug: 'MyLP' })).toThrow();
  });

  it('rejects slug shorter than 3 chars', () => {
    expect(() => parseLpConfig({ ...BASE, slug: 'ab' })).toThrow();
  });

  it('rejects slug with spaces', () => {
    expect(() => parseLpConfig({ ...BASE, slug: 'my lp' })).toThrow();
  });

  it('rejects slug with special characters', () => {
    expect(() => parseLpConfig({ ...BASE, slug: 'my_lp' })).toThrow();
  });

  it('rejects more than 6 bullets', () => {
    const bullets = Array.from({ length: 7 }, (_, i) => `bullet ${i}`);
    expect(() => parseLpConfig({ ...BASE, bullets })).toThrow();
  });

  it('rejects more than 8 form fields', () => {
    const fields = Array.from({ length: 9 }, (_, i) => ({
      name: `f${i}`,
      label: `Field ${i}`,
      type: 'text' as const,
      required: false,
    }));
    expect(() =>
      parseLpConfig({ ...BASE, form: { fields, submit_label: 'Go', success_message: 'Done' } }),
    ).toThrow();
  });

  it('rejects empty form fields array', () => {
    expect(() =>
      parseLpConfig({
        ...BASE,
        form: { fields: [], submit_label: 'Go', success_message: 'Done' },
      }),
    ).toThrow();
  });

  it('rejects invalid tracking campaign_id (not UUID)', () => {
    expect(() =>
      parseLpConfig({ ...BASE, tracking: { campaign_id: 'not-a-uuid' } }),
    ).toThrow();
  });

  it('rejects unknown template ID', () => {
    expect(() =>
      parseLpConfig({ ...BASE, template: 'template_c_unknown' as never }),
    ).toThrow();
  });
});

describe('safeParseLpConfig', () => {
  it('returns success: true for valid input', () => {
    const r = safeParseLpConfig(BASE);
    expect(r.success).toBe(true);
  });

  it('returns success: false for invalid input', () => {
    const r = safeParseLpConfig({ ...BASE, slug: 'BAD SLUG' });
    expect(r.success).toBe(false);
  });
});
