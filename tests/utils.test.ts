import { describe, it, expect } from "vitest";
import { formatTime, generateId } from "../utils";

describe("Utils", () => {
  describe("formatTime", () => {
    it("formats zero seconds", () => {
      expect(formatTime(0)).toBe("0:00");
    });

    it("formats seconds with padding", () => {
      expect(formatTime(61)).toBe("1:01");
    });

    it("formats large values", () => {
      expect(formatTime(3600)).toBe("60:00");
    });
  });

  describe("generateId", () => {
    it("returns a string", () => {
      const id = generateId();
      expect(typeof id).toBe("string");
    });

    it("returns unique values", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });
});
