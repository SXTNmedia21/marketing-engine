import type { ObjectDef } from '../types.js';

export const PixelAccount: ObjectDef = {
  nameSingular: 'pixelAccount',
  namePlural: 'pixelAccounts',
  labelSingular: 'Pixel Account',
  labelPlural: 'Pixel Accounts',
  description: 'Per-platform tracking account: pixel ID + CAPI token reference.',
  icon: 'IconTarget',
  fields: [
    {
      name: 'platform',
      label: 'Platform',
      type: 'SELECT',
      isNullable: false,
      options: [
        { value: 'meta', label: 'Meta', color: 'blue', position: 0 },
        { value: 'tiktok', label: 'TikTok', color: 'pink', position: 1 },
        { value: 'google', label: 'Google', color: 'yellow', position: 2 },
        { value: 'linkedin', label: 'LinkedIn', color: 'blue', position: 3 },
      ],
    },
    {
      name: 'name',
      label: 'Name',
      type: 'TEXT',
      isNullable: false,
      description: 'Internal label, e.g. "Meta - Smartout main".',
    },
    {
      name: 'platformAccountId',
      label: 'Platform Account ID',
      type: 'TEXT',
      isNullable: false,
    },
    {
      name: 'pixelId',
      label: 'Pixel ID',
      type: 'TEXT',
    },
    {
      name: 'capiTokenRef',
      label: 'CAPI Token Reference',
      type: 'TEXT',
      description: '1Password op:// URI. NEVER store raw token.',
    },
    {
      name: 'capiTokenStatus',
      label: 'CAPI Token Status',
      type: 'SELECT',
      defaultValue: 'unknown',
      options: [
        { value: 'unknown', label: 'Unknown', color: 'gray', position: 0 },
        { value: 'valid', label: 'Valid', color: 'green', position: 1 },
        { value: 'expired', label: 'Expired', color: 'orange', position: 2 },
        { value: 'invalid', label: 'Invalid', color: 'red', position: 3 },
      ],
    },
    {
      name: 'capiLastVerifiedAt',
      label: 'CAPI Last Verified At',
      type: 'DATE_TIME',
    },
    {
      name: 'domainVerified',
      label: 'Domain Verified',
      type: 'BOOLEAN',
      defaultValue: false,
    },
    {
      name: 'eventTestCode',
      label: 'Event Test Code',
      type: 'TEXT',
      description: 'For staging — Meta requires test code in dev.',
    },
    {
      name: 'isPrimary',
      label: 'Is Primary',
      type: 'BOOLEAN',
      defaultValue: false,
      description: 'Default account for this platform if multiple exist.',
    },
  ],
  relations: [],
};
