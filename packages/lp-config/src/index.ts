import { z } from 'zod';

export const TemplateIdSchema = z.enum(['template_a_lead_capture', 'template_b_long_form']);
export type TemplateId = z.infer<typeof TemplateIdSchema>;

export const ThemeSchema = z.object({
  primary: z.string(),
  background: z.string(),
  text: z.string(),
  accent: z.string().optional(),
});

export const FormFieldSchema = z.object({
  name: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  type: z.enum(['email', 'text', 'tel', 'textarea', 'select', 'checkbox']),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const FormSchema = z.object({
  fields: z.array(FormFieldSchema).min(1).max(8),
  submit_label: z.string().min(1).max(64),
  success_message: z.string().min(1).max(256),
  redirect_url: z.string().url().optional(),
});

export const HeroSchema = z.object({
  headline: z.string().min(1).max(140),
  subheadline: z.string().max(280).optional(),
  image_url: z.string().url().optional(),
  video_url: z.string().url().optional(),
});

export const PixelsSchema = z.object({
  meta: z.object({ pixel_id: z.string(), capi_token_ref: z.string().optional() }).optional(),
  google: z.object({ measurement_id: z.string(), api_secret_ref: z.string().optional() }).optional(),
  tiktok: z.object({ pixel_id: z.string(), token_ref: z.string().optional() }).optional(),
  linkedin: z.object({ partner_id: z.string() }).optional(),
});

export const TrackingSchema = z.object({
  campaign_id: z.string().uuid(),
  ad_id: z.string().optional(),
  variant: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

export const LpConfigSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'lowercase, digits, hyphen only'),
  template: TemplateIdSchema,
  version: z.number().int().positive().default(1),
  theme: ThemeSchema,
  hero: HeroSchema,
  bullets: z.array(z.string().max(280)).max(6).default([]),
  form: FormSchema,
  pixels: PixelsSchema.default({}),
  tracking: TrackingSchema,
  status: z.enum(['draft', 'active', 'paused', 'deleted']).default('draft'),
});

export type LpConfig = z.infer<typeof LpConfigSchema>;
export type FormField = z.infer<typeof FormFieldSchema>;
export type Theme = z.infer<typeof ThemeSchema>;

export function parseLpConfig(input: unknown): LpConfig {
  return LpConfigSchema.parse(input);
}

export function safeParseLpConfig(input: unknown) {
  return LpConfigSchema.safeParse(input);
}
