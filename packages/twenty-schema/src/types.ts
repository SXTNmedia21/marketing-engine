// Twenty Metadata API types — declarative object/field/relation definitions.
// Mirrors Twenty's createOneObject + createOneField + createOneRelation mutations.

export type FieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'DATE_TIME'
  | 'DATE'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'EMAIL'
  | 'PHONE'
  | 'LINK'
  | 'CURRENCY'
  | 'RAW_JSON'
  | 'UUID'
  | 'RATING'
  | 'POSITION'
  | 'RICH_TEXT';

export interface FieldDef {
  name: string; // camelCase, e.g. "campaignName"
  label: string; // human label
  description?: string;
  type: FieldType;
  isNullable?: boolean;
  defaultValue?: unknown;
  options?: SelectOption[]; // for SELECT / MULTI_SELECT
  settings?: Record<string, unknown>; // currency code, datetime mode, etc.
}

export interface SelectOption {
  id?: string;
  value: string;
  label: string;
  color?: string;
  position?: number;
}

export type RelationCardinality = 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'ONE_TO_ONE';

export interface RelationDef {
  name: string; // field name on this object
  label: string;
  description?: string;
  cardinality: RelationCardinality;
  targetObject: string; // namePlural of target, e.g. "campaigns"
  targetFieldName: string; // inverse field on target
  targetFieldLabel: string;
  isNullable?: boolean;
}

export interface ObjectDef {
  nameSingular: string; // e.g. "campaign"
  namePlural: string;   // e.g. "campaigns"
  labelSingular: string;
  labelPlural: string;
  description: string;
  icon: string; // Tabler icon name without prefix, e.g. "IconRocket"
  fields: FieldDef[];
  relations: RelationDef[];
  /**
   * If true, this is an extension to a built-in Twenty object (Person, Company),
   * not a new custom object. Used for LeadAttribution which extends Person.
   */
  extendsBuiltin?: 'person' | 'company';
}

export interface SeedReport {
  objectsCreated: string[];
  objectsSkipped: string[];
  fieldsCreated: number;
  relationsCreated: number;
  errors: { context: string; error: string }[];
}
