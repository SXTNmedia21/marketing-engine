import type { ObjectDef } from '../types.js';

export const LandingPage: ObjectDef = {
  nameSingular: 'landingPage',
  namePlural: 'landingPages',
  labelSingular: 'Landing Page',
  labelPlural: 'Landing Pages',
  description: 'Edge-rendered landing page — config in KV, version-tracked.',
  icon: 'IconFileText',
  fields: [
    {
      name: 'slug',
      label: 'Slug',
      type: 'TEXT',
      isNullable: false,
      description: 'lowercase-kebab-case. Used in URL: /lp/<slug>',
    },
    {
      name: 'template',
      label: 'Template',
      type: 'SELECT',
      isNullable: false,
      options: [
        { value: 'template_a_lead_capture', label: 'A — Lead Capture', color: 'blue', position: 0 },
        { value: 'template_b_long_form', label: 'B — Long Form', color: 'purple', position: 1 },
      ],
    },
    {
      name: 'version',
      label: 'Version',
      type: 'NUMBER',
      defaultValue: 1,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'SELECT',
      defaultValue: 'draft',
      isNullable: false,
      options: [
        { value: 'draft', label: 'Draft', color: 'gray', position: 0 },
        { value: 'active', label: 'Active', color: 'green', position: 1 },
        { value: 'paused', label: 'Paused', color: 'orange', position: 2 },
        { value: 'archived', label: 'Archived', color: 'red', position: 3 },
      ],
    },
    {
      name: 'configJson',
      label: 'Config JSON',
      type: 'RAW_JSON',
      isNullable: false,
      description: 'Full LP config — validated by @me/lp-config Zod schema before save.',
    },
    {
      name: 'kvSyncedAt',
      label: 'KV Synced At',
      type: 'DATE_TIME',
      description: 'Last time config was pushed to Cloudflare KV.',
    },
    {
      name: 'kvSyncStatus',
      label: 'KV Sync Status',
      type: 'SELECT',
      options: [
        { value: 'pending', label: 'Pending', color: 'gray', position: 0 },
        { value: 'synced', label: 'Synced', color: 'green', position: 1 },
        { value: 'failed', label: 'Failed', color: 'red', position: 2 },
      ],
    },
    {
      name: 'previewUrl',
      label: 'Preview URL',
      type: 'LINK',
      description: 'Staging URL for review before publish.',
    },
    {
      name: 'liveUrl',
      label: 'Live URL',
      type: 'LINK',
    },
    {
      name: 'expiresAt',
      label: 'Expires At',
      type: 'DATE_TIME',
      description: 'Auto-deactivate after this timestamp.',
    },
  ],
  relations: [
    {
      name: 'campaign',
      label: 'Campaign',
      cardinality: 'MANY_TO_ONE',
      targetObject: 'campaigns',
      targetFieldName: 'landingPages',
      targetFieldLabel: 'Landing Pages',
    },
    {
      name: 'ads',
      label: 'Ads',
      cardinality: 'ONE_TO_MANY',
      targetObject: 'ads',
      targetFieldName: 'landingPage',
      targetFieldLabel: 'Landing Page',
    },
  ],
};
