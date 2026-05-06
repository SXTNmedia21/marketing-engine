// Set required env vars before any module imports config.ts
process.env['NODE_ENV'] = 'development';
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['CONTROL_PLANE_TOKEN'] = 'test_control_plane_token_32chars';
process.env['TWENTY_API_URL'] = 'http://localhost:3000';
process.env['TWENTY_API_TOKEN'] = 'test_twenty_token';
