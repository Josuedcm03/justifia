import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Structural checks (BS-MOT-1, BS-CTX-1): there is no browser layer, so the
// shell sources are read as text.
const read = (file: string) =>
  readFileSync(join(process.cwd(), "src/components", file), "utf8");

describe("shell motion (BS-MOT-1: no `all` transitions)", () => {
  it.each(["theme-toggle.tsx", "dashboard-header.tsx", "app-sidebar.tsx"])(
    "%s has no transition-all",
    (file) => {
      expect(read(file)).not.toMatch(/transition-all|transition:\s*all/);
    },
  );

  it("names the properties the theme toggle icons change", () => {
    const source = read("theme-toggle.tsx");

    expect(source.match(/transition-\[scale,rotate\]/g)).toHaveLength(2);
  });
});

describe("dashboard header (BS-CTX-1)", () => {
  it("renders the page context on the leading side and shares the initials helper", () => {
    const source = read("dashboard-header.tsx");

    expect(source).toContain('from "@/components/page-context"');
    expect(source).toMatch(/<SidebarTrigger \/>\s*<PageContext \/>/);
    expect(source).toContain('from "@/lib/initials"');
    expect(source).not.toMatch(/function initials\(/);
  });
});
