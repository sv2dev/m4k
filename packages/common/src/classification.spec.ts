import { describe, expect, test } from "bun:test";
import { validateClassificationOptions } from "./classification.js";

const config = {
  classifierId: "clip-image-labels",
  classifierVersion: "1",
  labels: ["landscape", "receipt"],
};

describe("validateClassificationOptions", () => {
  test("accepts a bounded, versioned candidate set", () => {
    const input = config;

    const valid = validateClassificationOptions(input);

    expect(valid).toBe(true);
  });

  test("accepts the eighty-character label boundary", () => {
    const input = { ...config, labels: ["x".repeat(80), "receipt"] };

    const valid = validateClassificationOptions(input);

    expect(valid).toBe(true);
  });

  test("rejects whitespace, braces, controls and overlong labels", () => {
    const invalid = [" leading", "trailing ", "{label}", "line\nbreak", "x".repeat(81)];

    const valid = invalid.map((label) =>
      validateClassificationOptions({ ...config, labels: [label, "receipt"] }),
    );

    expect(valid).toEqual([false, false, false, false, false]);
  });

  test("rejects unsupported versions and duplicate, empty or excessive candidates", () => {
    const inputs = [
      { ...config, classifierVersion: "latest" },
      { ...config, labels: ["x", "x"] },
      { ...config, labels: ["", "x"] },
      { ...config, labels: ["x"] },
      { ...config, labels: Array.from({ length: 33 }, (_, i) => String(i)) },
    ];

    const results = inputs.map(validateClassificationOptions);

    expect(results).toEqual([false, false, false, false, false]);
  });
});
