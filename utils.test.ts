import { formatTime, generateId } from "./utils";

// Mocking Vitest since it might not be installed yet
// In a real scenario, we would run: npm install -D vitest
const describe = (name: string, fn: () => void) => {
  console.log(`Suite: ${name}`);
  fn();
};
const it = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`  ✔ ${name}`);
  } catch (e) {
    console.error(`  ✘ ${name}`, e);
  }
};
const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`);
  },
});

describe("Utils", () => {
  it("formatTime formats seconds correctly", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(61)).toBe("1:01");
    expect(formatTime(3600)).toBe("60:00");
  });

  it("generateId returns a string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
  });
});
