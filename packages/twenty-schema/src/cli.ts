#!/usr/bin/env node
import { TwentyMetadataClient } from './client.js';
import { seedTwentySchema } from './seed.js';

interface CliFlags {
  dryRun: boolean;
  skipExisting: boolean;
  url: string;
  token: string;
}

function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = {
    dryRun: argv.includes('--dry-run'),
    skipExisting: !argv.includes('--no-skip-existing'),
    url: process.env.TWENTY_METADATA_URL ?? 'http://localhost:3000/metadata',
    token: process.env.TWENTY_API_TOKEN ?? '',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url' && argv[i + 1]) {
      flags.url = argv[i + 1]!;
      i++;
    } else if (a === '--token' && argv[i + 1]) {
      flags.token = argv[i + 1]!;
      i++;
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));

  if (!flags.token && !flags.dryRun) {
    console.error('ERROR: TWENTY_API_TOKEN env or --token <value> required (unless --dry-run).');
    process.exit(1);
  }

  console.log('Twenty Schema Seed');
  console.log('==================');
  console.log(`URL:           ${flags.url}`);
  console.log(`Dry run:       ${flags.dryRun}`);
  console.log(`Skip existing: ${flags.skipExisting}`);
  console.log();

  const client = new TwentyMetadataClient({
    metadata_url: flags.url,
    api_token: flags.token,
  });

  const report = await seedTwentySchema(client, {
    dryRun: flags.dryRun,
    skipExisting: flags.skipExisting,
  });

  console.log();
  console.log('Report');
  console.log('------');
  console.log(`Objects created:  ${report.objectsCreated.length} [${report.objectsCreated.join(', ')}]`);
  console.log(`Objects skipped:  ${report.objectsSkipped.length} [${report.objectsSkipped.join(', ')}]`);
  console.log(`Fields created:   ${report.fieldsCreated}`);
  console.log(`Relations created: ${report.relationsCreated}`);
  console.log(`Errors:           ${report.errors.length}`);
  if (report.errors.length > 0) {
    console.log();
    console.log('Errors:');
    for (const e of report.errors) {
      console.log(`  ${e.context}: ${e.error}`);
    }
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
