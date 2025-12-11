import { describe, it, expect } from "vitest";

describe("Vibe Machine", () => {
  it("exports VisualizerMode enum", async () => {
    const { VisualizerMode } = await import("../types");
    expect(VisualizerMode).toBeDefined();
    expect(VisualizerMode.Bars).toBe("Bars");
  });

  it("exports AspectRatio enum", async () => {
    const { AspectRatio } = await import("../types");
    expect(AspectRatio).toBeDefined();
    expect(AspectRatio.SixteenNine).toBe("16/9");
  });
});
