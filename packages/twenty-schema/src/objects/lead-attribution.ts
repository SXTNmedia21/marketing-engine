import type { ObjectDef } from '../types.js';

/**
 * LeadAttribution is a NEW object linked many-to-one to Twenty's built-in Person.
 * We don't extend Person directly — instead each Person can have many LeadAttribution
 * records, one per touch (or compressed to one with full path).
 *
 * v1 approach: one LeadAttribution per Person, holding the full attribution_path JSON.
 * If we later want event-stream attribution, this can split into LeadTouch + LeadAttribution.
 */
export const LeadAttribution: ObjectDef = {
  nameSingular: 'leadAttribution',
  namePlural: 'leadAttributions',
  labelSingular: 'Lead Attribution',
  labelPlural: 'Lead Attributions',
  description: 'Marketing attribution for a Person — touch points, scoring, source LP/ad.',
  icon: 'IconRoute',
  fields: [
    {
      name: 'visitorId',
      label: 'Visitor ID',
      type: 'TEXT',
      isNullable: false,
      description: 'First-party cookie ID, links events before identification.',
    },
    {
      name: 'firstTouch',
      label: 'First Touch',
      type: 'RAW_JSON',
      description: 'First channel/source/campaign tuple.',
    },
    {
      name: 'lastTouch',
      label: 'Last Touch',
      type: 'RAW_JSON',
      description: 'Most recent channel/source/campaign tuple before identification.',
    },
    {
      name: 'attributionPath',
      label: 'Attribution Path',
      type: 'RAW_JSON',
      description: 'Ordered list of touches: [{ts, channel, campaign_id, ad_id, slug}].',
    },
    {
      name: 'attributionModel',
      label: 'Attribution Model',
      type: 'SELECT',
      defaultValue: 'last_touch',
      options: [
        { value: 'first_touch', label: 'First Touch', color: 'blue', position: 0 },
        { value: 'last_touch', label: 'Last Touch', color: 'purple', position: 1 },
        { value: 'linear', label: 'Linear', color: 'green', position: 2 },
        { value: 'data_driven', label: 'Data Driven', color: 'orange', position: 3 },
      ],
    },
    {
      name: 'engagementScore',
      label: 'Engagement Score',
      type: 'NUMBER',
      defaultValue: 0,
      description: '0-100, weighted by time/scroll/interactions.',
    },
    {
      name: 'intentScore',
      label: 'Intent Score',
      type: 'NUMBER',
      defaultValue: 0,
      description: '0-100, heuristic: form-focus + deep scroll + return.',
    },
    {
      name: 'leadScore',
      label: 'Lead Score',
      type: 'NUMBER',
      defaultValue: 0,
      description: '0-100, combined score for routing per OPERATIONS section 5.',
    },
    {
      name: 'leadCategory',
      label: 'Lead Category',
      type: 'SELECT',
      defaultValue: 'cold',
      options: [
        { value: 'cold', label: 'Cold', color: 'gray', position: 0 },
        { value: 'warm', label: 'Warm', color: 'blue', position: 1 },
        { value: 'hot', label: 'Hot', color: 'orange', position: 2 },
        { value: 'on_fire', label: 'On Fire', color: 'red', position: 3 },
      ],
    },
    {
      name: 'identifiedAt',
      label: 'Identified At',
      type: 'DATE_TIME',
      description: 'When visitor became known Person (form submit).',
    },
    {
      name: 'consentState',
      label: 'Consent State',
      type: 'SELECT',
      defaultValue: 'unknown',
      options: [
        { value: 'granted', label: 'Granted', color: 'green', position: 0 },
        { value: 'denied', label: 'Denied', color: 'red', position: 1 },
        { value: 'unknown', label: 'Unknown', color: 'gray', position: 2 },
      ],
    },
    {
      name: 'totalSessions',
      label: 'Total Sessions',
      type: 'NUMBER',
      defaultValue: 0,
    },
    {
      name: 'totalPageviews',
      label: 'Total Pageviews',
      type: 'NUMBER',
      defaultValue: 0,
    },
    {
      name: 'lastSeenAt',
      label: 'Last Seen At',
      type: 'DATE_TIME',
    },
    {
      name: 'utmSource',
      label: 'UTM Source',
      type: 'TEXT',
    },
    {
      name: 'utmMedium',
      label: 'UTM Medium',
      type: 'TEXT',
    },
    {
      name: 'utmCampaign',
      label: 'UTM Campaign',
      type: 'TEXT',
    },
    {
      name: 'clickId',
      label: 'Click ID',
      type: 'TEXT',
      description: 'fbclid / gclid / ttclid / msclkid / li_fat_id.',
    },
  ],
  relations: [
    // person relation handled at seed time — Person is built-in
    {
      name: 'firstLandingPage',
      label: 'First Landing Page',
      cardinality: 'MANY_TO_ONE',
      targetObject: 'landingPages',
      targetFieldName: 'firstAttributions',
      targetFieldLabel: 'First Attributions',
      isNullable: true,
    },
    {
      name: 'lastLandingPage',
      label: 'Last Landing Page',
      cardinality: 'MANY_TO_ONE',
      targetObject: 'landingPages',
      targetFieldName: 'lastAttributions',
      targetFieldLabel: 'Last Attributions',
      isNullable: true,
    },
    {
      name: 'firstCampaign',
      label: 'First Campaign',
      cardinality: 'MANY_TO_ONE',
      targetObject: 'campaigns',
      targetFieldName: 'firstAttributions',
      targetFieldLabel: 'First Attributions',
      isNullable: true,
    },
    {
      name: 'lastCampaign',
      label: 'Last Campaign',
      cardinality: 'MANY_TO_ONE',
      targetObject: 'campaigns',
      targetFieldName: 'lastAttributions',
      targetFieldLabel: 'Last Attributions',
      isNullable: true,
    },
  ],
};
