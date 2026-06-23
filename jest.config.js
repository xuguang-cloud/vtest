/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/acceptance/',
    '/src/main/core/apk/',
    '/src/main/core/device/',
    '/src/main/core/extract/',
    '/src/main/core/locator/',
    '/src/main/core/plugin/',
    '/src/main/core/script/',
    '/src/main/core/comparison/TranslationComparator.test.ts',
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/renderer/**/*.tsx',
    '!src/__tests__/**/*.ts',
    '!src/**/*.integration.test.ts',
    '!src/**/*.integration.spec.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
