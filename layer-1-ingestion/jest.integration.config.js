module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.js'],
  setupFiles: ['dotenv/config'],
  testTimeout: 30000,
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        isolateModules: true,
        tsconfig: { allowJs: true },
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!@mstock-mirae-asset)'],
};
