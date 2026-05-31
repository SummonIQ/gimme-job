const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared types and generated directories from the monorepo root
config.watchFolders = [
  path.resolve(monorepoRoot, 'types'),
  path.resolve(monorepoRoot, 'generated'),
];

// Ensure Metro can resolve modules from the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
