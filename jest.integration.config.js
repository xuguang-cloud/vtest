/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/*.integration.test.ts',
    '**/*.integration.spec.ts',
    '**/__tests__/integration/**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/integration/setup.ts'],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/renderer/**/*.tsx',
    '!src/__tests__/**/*.ts',
  ],
}
