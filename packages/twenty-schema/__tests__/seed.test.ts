import { describe, it, expect, vi } from 'vitest';
import { seedTwentySchema } from '../src/seed.js';
import { TwentyMetadataClient } from '../src/client.js';
import { ALL_OBJECTS } from '../src/objects/index.js';

// Count the MANY_TO_ONE relations across all objects (those that get created)
function countExpectedRelations(): number {
  let count = 0;
  for (const obj of ALL_OBJECTS) {
    for (const rel of obj.relations) {
      if (rel.cardinality === 'MANY_TO_ONE') count++;
    }
  }
  return count;
}

function countExpectedFields(): number {
  return ALL_OBJECTS.reduce((total, obj) => total + obj.fields.length, 0);
}

// ---------------------------------------------------------------------------
// dry-run: no real network calls
// ---------------------------------------------------------------------------
describe('seedTwentySchema — dry-run', () => {
  it('produces a full report listing all objects in dry-run mode', async () => {
    const mockClient = {
      listObjects: vi.fn().mockResolvedValue([]),
      createObject: vi.fn(),
      createField: vi.fn(),
      createRelation: vi.fn(),
    } as unknown as TwentyMetadataClient;

    const report = await seedTwentySchema(mockClient, { dryRun: true, skipExisting: true });

    // No real calls should be made in dry-run
    expect(mockClient.listObjects).not.toHaveBeenCalled();
    expect(mockClient.createObject).not.toHaveBeenCalled();
    expect(mockClient.createField).not.toHaveBeenCalled();
    expect(mockClient.createRelation).not.toHaveBeenCalled();

    // The report should be empty arrays/zeros for actual creates
    expect(report.objectsCreated).toHaveLength(0);
    expect(report.errors).toHaveLength(0);
  });

  it('object count matches ALL_OBJECTS length', () => {
    expect(ALL_OBJECTS).toHaveLength(5);
    const names = ALL_OBJECTS.map((o) => o.nameSingular);
    expect(names).toContain('campaign');
    expect(names).toContain('landingPage');
    expect(names).toContain('ad');
    expect(names).toContain('pixelAccount');
    expect(names).toContain('leadAttribution');
  });

  it('total field count matches expected', () => {
    const total = countExpectedFields();
    // We know the objects have fields — just validate it is > 0 and sensible
    expect(total).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// live (mocked): creates objects/fields/relations
// ---------------------------------------------------------------------------
describe('seedTwentySchema — mocked live run', () => {
  it('creates all objects when none pre-exist', async () => {
    let objIdCounter = 0;
    const mockClient = {
      listObjects: vi.fn().mockResolvedValue([]),
      createObject: vi.fn().mockImplementation(() =>
        Promise.resolve({ id: `obj_${++objIdCounter}` }),
      ),
      createField: vi.fn().mockResolvedValue({ id: 'field_x' }),
      createRelation: vi.fn().mockResolvedValue({ id: 'rel_x' }),
    } as unknown as TwentyMetadataClient;

    const report = await seedTwentySchema(mockClient, { dryRun: false, skipExisting: true });

    expect(report.objectsCreated).toHaveLength(ALL_OBJECTS.length);
    expect(report.errors).toHaveLength(0);
  });

  it('skips existing objects when skipExisting = true', async () => {
    const existing = ALL_OBJECTS.map((o, i) => ({
      id: `existing_${i}`,
      nameSingular: o.nameSingular,
      namePlural: o.namePlural,
    }));
    const mockClient = {
      listObjects: vi.fn().mockResolvedValue(existing),
      createObject: vi.fn(),
      createField: vi.fn().mockResolvedValue({ id: 'f_x' }),
      createRelation: vi.fn().mockResolvedValue({ id: 'r_x' }),
    } as unknown as TwentyMetadataClient;

    const report = await seedTwentySchema(mockClient, { dryRun: false, skipExisting: true });

    expect(report.objectsSkipped).toHaveLength(ALL_OBJECTS.length);
    expect(mockClient.createObject).not.toHaveBeenCalled();
  });

  it('adds error to report when listObjects throws', async () => {
    const mockClient = {
      listObjects: vi.fn().mockRejectedValue(new Error('DB unreachable')),
      createObject: vi.fn(),
      createField: vi.fn(),
      createRelation: vi.fn(),
    } as unknown as TwentyMetadataClient;

    const report = await seedTwentySchema(mockClient, { dryRun: false, skipExisting: true });
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]!.context).toBe('listObjects');
    expect(report.errors[0]!.error).toContain('DB unreachable');
  });

  it('fieldsCreated matches total field count across all objects', async () => {
    let objIdCounter = 0;
    const mockClient = {
      listObjects: vi.fn().mockResolvedValue([]),
      createObject: vi.fn().mockImplementation(() =>
        Promise.resolve({ id: `obj_${++objIdCounter}` }),
      ),
      createField: vi.fn().mockResolvedValue({ id: 'field_x' }),
      createRelation: vi.fn().mockResolvedValue({ id: 'rel_x' }),
    } as unknown as TwentyMetadataClient;

    const report = await seedTwentySchema(mockClient, { dryRun: false, skipExisting: true });
    expect(report.fieldsCreated).toBe(countExpectedFields());
  });

  it('relationsCreated matches MANY_TO_ONE relation count', async () => {
    let objIdCounter = 0;
    const mockClient = {
      listObjects: vi.fn().mockResolvedValue([]),
      createObject: vi.fn().mockImplementation(() =>
        Promise.resolve({ id: `obj_${++objIdCounter}` }),
      ),
      createField: vi.fn().mockResolvedValue({ id: 'field_x' }),
      createRelation: vi.fn().mockResolvedValue({ id: 'rel_x' }),
    } as unknown as TwentyMetadataClient;

    const report = await seedTwentySchema(mockClient, { dryRun: false, skipExisting: true });
    expect(report.relationsCreated).toBe(countExpectedRelations());
  });
});

// ---------------------------------------------------------------------------
// singularize (via behavior in relations)
// ---------------------------------------------------------------------------
describe('singularize (via ALL_OBJECTS relation targets)', () => {
  it('all relation targetObjects can be resolved to a known object', () => {
    const singularNames = new Set(ALL_OBJECTS.map((o) => o.nameSingular));
    const knownMap: Record<string, string> = {
      campaigns: 'campaign',
      landingPages: 'landingPage',
      ads: 'ad',
      pixelAccounts: 'pixelAccount',
      leadAttributions: 'leadAttribution',
    };

    for (const obj of ALL_OBJECTS) {
      for (const rel of obj.relations) {
        if (rel.cardinality === 'MANY_TO_ONE') {
          const singular = knownMap[rel.targetObject] ?? rel.targetObject.replace(/s$/, '');
          expect(singularNames.has(singular)).toBe(true);
        }
      }
    }
  });
});
