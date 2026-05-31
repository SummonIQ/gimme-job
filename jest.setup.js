import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers with accessibility assertions
expect.extend(toHaveNoViolations);
