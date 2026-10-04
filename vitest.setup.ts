import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Under a full parallel run a cold component can take longer than Testing
// Library's 1s default to settle; a passing wait still returns immediately.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});
