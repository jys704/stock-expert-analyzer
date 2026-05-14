import { describe, expect, it } from "vitest";
import { decodePdfDataUrl, sanitizeStorageSegment } from "./analysisUtils";

describe("analysisUtils", () => {
  it("sanitizes storage path segments while preserving useful identifiers", () => {
    expect(sanitizeStorageSegment(" NVDA / AI 반도체 ")).toBe("NVDA-AI-반도체");
    expect(sanitizeStorageSegment("***", "fallback")).toBe("fallback");
  });

  it("decodes application/pdf data URLs", () => {
    const payload = Buffer.from("%PDF-1.4\nbody", "utf8").toString("base64");
    const decoded = decodePdfDataUrl(`data:application/pdf;base64,${payload}`);

    expect(decoded.toString("utf8")).toBe("%PDF-1.4\nbody");
  });

  it("rejects non-PDF data URLs", () => {
    expect(() => decodePdfDataUrl("data:text/plain;base64,SGVsbG8=")).toThrow("PDF data URL");
  });
});
