import '@testing-library/jest-dom/vitest';
import { loadEnvConfig } from '@next/env';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

loadEnvConfig(process.cwd());

// Extend Vitest's expect with jest-axe matchers
expect.extend(toHaveNoViolations);
