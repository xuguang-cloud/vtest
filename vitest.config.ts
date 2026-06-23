import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/main/core/plugin/*.test.ts',
      'src/main/core/device/*.test.ts',
      'src/main/core/locator/*.test.ts',
      'src/main/core/extract/*.test.ts',
      'src/main/core/script/*.test.ts',
      'src/main/core/comparison/TranslationComparator.test.ts',
      'src/main/core/apk/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/main/core/plugin/PluginHost.ts',
        'src/main/core/device/DeviceManager.ts',
        'src/main/core/device/AVDConnector.ts',
        'src/main/core/locator/ElementLocator.ts',
        'src/main/core/extract/ExtractEngine.ts',
        'src/main/core/script/PageObjectGenerator.ts',
        'src/main/core/comparison/TranslationComparator.ts',
        'src/main/core/apk/APKInstaller.ts'
      ],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
})
