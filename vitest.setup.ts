import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Stable singleton router mock so tests can assert on the same spy
// the component received during render.
const routerMock = {
  push: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
}));
