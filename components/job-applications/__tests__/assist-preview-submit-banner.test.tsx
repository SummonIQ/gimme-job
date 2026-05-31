import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssistPreviewSubmitBanner } from '../assist-preview-submit-banner';

describe('AssistPreviewSubmitBanner', () => {
  it('matches the required preview-only footer banner copy', () => {
    const { container, getByText } = render(<AssistPreviewSubmitBanner />);

    expect(
      getByText(
        'This preview cannot submit applications. Submit via the desktop runtime or manually.',
      ),
    ).toBeInTheDocument();
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="relative w-full rounded-lg border p-4 [&>svg~*]:pl-8 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400 my-0"
        role="alert"
      >
        <svg
          aria-hidden="true"
          class="lucide lucide-info"
          fill="none"
          height="24"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
          />
          <path
            d="M12 16v-4"
          />
          <path
            d="M12 8h.01"
          />
        </svg>
        <h5
          class="mb-2.5 font-medium leading-none tracking-tight"
        >
          AI Preview only
        </h5>
        <div
          class="text-sm [&_p]:leading-relaxed"
        >
          This preview cannot submit applications. Submit via the desktop runtime or manually.
        </div>
      </div>
    `);
  });
});
