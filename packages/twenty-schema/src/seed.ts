import { logger } from '@me/shared';
import { TwentyMetadataClient } from './client.js';
import { ALL_OBJECTS } from './objects/index.js';
import type { ObjectDef, FieldDef, RelationDef, SeedReport } from './types.js';

export interface SeedOptions {
  dryRun: boolean;
  skipExisting: boolean;
}

export async function seedTwentySchema(
  client: TwentyMetadataClient,
  opts: SeedOptions = { dryRun: false, skipExisting: true },
): Promise<SeedReport> {
  const report: SeedReport = {
    objectsCreated: [],
    objectsSkipped: [],
    fieldsCreated: 0,
    relationsCreated: 0,
    errors: [],
  };

  let existing: { id: string; nameSingular: string; namePlural: string }[] = [];
  if (!opts.dryRun) {
    try {
      existing = await client.listObjects();
    } catch (err) {
      report.errors.push({ context: 'listObjects', error: String(err) });
      return report;
    }
  }
  const existingByName = new Map(existing.map((o) => [o.nameSingular, o.id]));

  // Phase 1: create objects (without relations)
  const createdIds = new Map<string, string>(existingByName);

  for (const obj of ALL_OBJECTS) {
    if (existingByName.has(obj.nameSingular)) {
      if (opts.skipExisting) {
        report.objectsSkipped.push(obj.nameSingular);
        logger.info({
          service: 'twenty-seed',
          event: 'object_skipped',
          payload: { name: obj.nameSingular },
        });
        continue;
      }
    }

    if (opts.dryRun) {
      logger.info({
        service: 'twenty-seed',
        event: 'object_would_create',
        payload: { name: obj.nameSingular },
      });
      createdIds.set(obj.nameSingular, `dry_${obj.nameSingular}`);
      continue;
    }

    const result = await client.createObject({
      nameSingular: obj.nameSingular,
      namePlural: obj.namePlural,
      labelSingular: obj.labelSingular,
      labelPlural: obj.labelPlural,
      description: obj.description,
      icon: obj.icon,
    });

    if ('error' in result) {
      report.errors.push({ context: `createObject:${obj.nameSingular}`, error: result.error });
      logger.error({
        service: 'twenty-seed',
        event: 'object_failed',
        payload: { name: obj.nameSingular, error: result.error },
      });
      continue;
    }

    createdIds.set(obj.nameSingular, result.id);
    report.objectsCreated.push(obj.nameSingular);
    logger.info({
      service: 'twenty-seed',
      event: 'object_created',
      payload: { name: obj.nameSingular, id: result.id },
    });
  }

  // Phase 2: create fields (skip relations — handled in phase 3)
  for (const obj of ALL_OBJECTS) {
    const objectId = createdIds.get(obj.nameSingular);
    if (!objectId) continue;

    for (const field of obj.fields) {
      if (opts.dryRun) {
        logger.info({
          service: 'twenty-seed',
          event: 'field_would_create',
          payload: { object: obj.nameSingular, field: field.name },
        });
        continue;
      }
      const ok = await createFieldSafe(client, objectId, field, obj.nameSingular, report);
      if (ok) report.fieldsCreated++;
    }
  }

  // Phase 3: relations (require both sides to exist)
  for (const obj of ALL_OBJECTS) {
    const fromId = createdIds.get(obj.nameSingular);
    if (!fromId) continue;

    for (const rel of obj.relations) {
      // Only create from one side — the side with namePlural matching targetObject is the inverse.
      // Convention: ONE_TO_MANY and MANY_TO_ONE — emit only from MANY_TO_ONE side to avoid duplicates.
      if (rel.cardinality === 'ONE_TO_MANY') continue;

      const targetSingular = singularize(rel.targetObject);
      const toId = createdIds.get(targetSingular);
      if (!toId) {
        report.errors.push({
          context: `relation:${obj.nameSingular}.${rel.name}`,
          error: `target_object_missing:${rel.targetObject}`,
        });
        continue;
      }

      if (opts.dryRun) {
        logger.info({
          service: 'twenty-seed',
          event: 'relation_would_create',
          payload: { from: obj.nameSingular, to: rel.targetObject, field: rel.name },
        });
        continue;
      }

      const result = await client.createRelation({
        fromObjectMetadataId: fromId,
        toObjectMetadataId: toId,
        fromName: rel.name,
        fromLabel: rel.label,
        ...(rel.description ? { fromDescription: rel.description } : {}),
        toName: rel.targetFieldName,
        toLabel: rel.targetFieldLabel,
        relationType: rel.cardinality,
      });

      if ('error' in result) {
        report.errors.push({
          context: `relation:${obj.nameSingular}.${rel.name}`,
          error: result.error,
        });
        continue;
      }

      report.relationsCreated++;
      logger.info({
        service: 'twenty-seed',
        event: 'relation_created',
        payload: { from: obj.nameSingular, to: rel.targetObject, field: rel.name },
      });
    }
  }

  return report;
}

async function createFieldSafe(
  client: TwentyMetadataClient,
  objectId: string,
  field: FieldDef,
  objectName: string,
  report: SeedReport,
): Promise<boolean> {
  const result = await client.createField({
    objectMetadataId: objectId,
    name: field.name,
    label: field.label,
    ...(field.description ? { description: field.description } : {}),
    type: field.type,
    isNullable: field.isNullable ?? true,
    ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
    ...(field.options ? { options: field.options } : {}),
    ...(field.settings ? { settings: field.settings } : {}),
  });

  if ('error' in result) {
    report.errors.push({
      context: `field:${objectName}.${field.name}`,
      error: result.error,
    });
    logger.warn({
      service: 'twenty-seed',
      event: 'field_failed',
      payload: { object: objectName, field: field.name, error: result.error },
    });
    return false;
  }
  return true;
}

function singularize(plural: string): string {
  // Domain-restricted: all our plurals are regular `+s`. Map known irregulars if needed.
  const known: Record<string, string> = {
    campaigns: 'campaign',
    landingPages: 'landingPage',
    ads: 'ad',
    pixelAccounts: 'pixelAccount',
    leadAttributions: 'leadAttribution',
  };
  if (plural in known) return known[plural]!;
  if (plural.endsWith('s')) return plural.slice(0, -1);
  return plural;
}

// Re-exports needed by external callers (e.g. _ used to silence unused warnings)
export { TwentyMetadataClient } from './client.js';
export type { ObjectDef, RelationDef };
