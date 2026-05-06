import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Only measure coverage on model + scoring logic files — not barrel re-exports
      include: [
        'src/models/first-touch.ts',
        'src/models/last-touch.ts',
        'src/models/linear.ts',
        'src/models/data-driven.ts',
        'src/scoring/engagement.ts',
        'src/scoring/intent.ts',
        'src/scoring/lead.ts',
      ],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
