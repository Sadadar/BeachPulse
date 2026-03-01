/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration/**/*.integration.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Integration tests hit live sites — give them plenty of time
  testTimeout: 60000,
  // Run serially to avoid hammering sites with concurrent requests
  maxWorkers: 1,
  // Don't fail fast — collect all results even if one scraper is down
  bail: false,
};
