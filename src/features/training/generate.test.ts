import { describe, expect, it } from "vitest";
import {
  generateTrainingPacketsSync,
  getPacketForRole,
} from "./generate";
import type { TrainingInput, TrainingPacket, TrainingRole } from "./types";

function makeInput(overrides: Partial<TrainingInput> = {}): TrainingInput {
  return {
    jobId: "job-1",
    autoMapped: 148_800,
    exceptionCount: 1_200,
    totalRecords: 150_000,
    goLiveDays: 2,
    autoMapRate: 0.992,
    ...overrides,
  };
}

// ─── generateTrainingPacketsSync ──────────────────────────────────────

describe("generateTrainingPacketsSync", () => {
  it("generates four packets, one per role", () => {
    const input = makeInput();
    const result = generateTrainingPacketsSync(input);

    expect(result.packets).toHaveLength(4);
    expect(result.generatedBy).toBe("fallback");

    const roles = result.packets.map((p) => p.role);
    expect(roles).toContain("owner");
    expect(roles).toContain("dispatcher");
    expect(roles).toContain("driver");
    expect(roles).toContain("csr");
  });

  it("each packet has a title, sections, and metadata", () => {
    const input = makeInput();
    const result = generateTrainingPacketsSync(input);

    for (const packet of result.packets) {
      expect(packet.title).toBeTruthy();
      expect(packet.sections.length).toBeGreaterThanOrEqual(1);
      expect(packet.generatedAt).toBeDefined();
      expect(packet.generatedBy).toBe("fallback");

      for (const section of packet.sections) {
        expect(section.heading).toBeTruthy();
        expect(section.body).toBeTruthy();
      }
    }
  });

  it("owner packet includes live numbers in the metrics section", () => {
    const input = makeInput({ autoMapped: 148_800, totalRecords: 150_000, autoMapRate: 0.992 });
    const result = generateTrainingPacketsSync(input);

    const ownerPacket = result.packets.find((p) => p.role === "owner")!;
    const metricsSection = ownerPacket.sections.find(
      (s) => s.heading === "What the Numbers Mean",
    );

    expect(metricsSection).toBeDefined();
    expect(metricsSection!.body).toContain("150,000");
    expect(metricsSection!.body).toContain("148,800");
    expect(metricsSection!.body).toContain("99.2%");
  });

  it("each role has exactly 4 sections", () => {
    const input = makeInput();
    const result = generateTrainingPacketsSync(input);

    for (const packet of result.packets) {
      expect(packet.sections).toHaveLength(4);
    }
  });

  it("no em-dashes in any packet body", () => {
    const input = makeInput();
    const result = generateTrainingPacketsSync(input);

    for (const packet of result.packets) {
      for (const section of packet.sections) {
        expect(section.body).not.toContain("\u2014"); // em-dash
        expect(section.body).not.toContain("\u2013"); // en-dash
      }
    }
  });

  it("packets are deterministic: same input = same output", () => {
    const input = makeInput();
    const result1 = generateTrainingPacketsSync(input);
    const result2 = generateTrainingPacketsSync(input);

    for (let i = 0; i < 4; i++) {
      expect(result1.packets[i].title).toBe(result2.packets[i].title);
      expect(result1.packets[i].sections).toEqual(result2.packets[i].sections);
    }
  });
});

// ─── getPacketForRole ─────────────────────────────────────────────────

describe("getPacketForRole", () => {
  it("returns the packet for a specific role", () => {
    const input = makeInput();
    const result = generateTrainingPacketsSync(input);

    const driverPacket = getPacketForRole(result.packets, "driver");
    expect(driverPacket).toBeDefined();
    expect(driverPacket!.role).toBe("driver");
    expect(driverPacket!.title).toContain("Driver");
  });

  it("returns undefined for an unknown role", () => {
    const input = makeInput();
    const result = generateTrainingPacketsSync(input);

    const unknown = getPacketForRole(result.packets, "mechanic" as TrainingRole);
    expect(unknown).toBeUndefined();
  });
});

// ─── content validation per role ──────────────────────────────────────

describe("role-specific content", () => {
  const input = makeInput();
  const result = generateTrainingPacketsSync(input);

  const roleChecks: Array<{ role: TrainingRole; expectedWords: string[] }> = [
    { role: "owner", expectedWords: ["dashboard", "pricing", "exception"] },
    { role: "dispatcher", expectedWords: ["route", "board", "conflict"] },
    { role: "driver", expectedWords: ["app", "stop", "photo"] },
    { role: "csr", expectedWords: ["customer", "account", "billing"] },
  ];

  for (const { role, expectedWords } of roleChecks) {
    it(`${role} packet contains role-relevant content`, () => {
      const packet = getPacketForRole(result.packets, role)!;
      const allText = packet.sections.map((s) => s.body).join(" ").toLowerCase();

      for (const word of expectedWords) {
        expect(allText).toContain(word);
      }
    });
  }
});
