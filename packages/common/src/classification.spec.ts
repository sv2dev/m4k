import { describe, expect, test } from "bun:test";
import { invalidInlineClassification, validateClassificationOptions } from "./classification.js";
import { isImageNoOp } from "./index.js";

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

describe("invalidInlineClassification", () => {
  test("accepts a classified jpeg output and a plain sibling", () => {
    const options = [{ format: "jpeg", classify: config }, { format: "avif" }];

    const problem = invalidInlineClassification(options);

    expect(problem).toBeUndefined();
  });

  test("requires an explicit format the classifier can read", () => {
    const missing = invalidInlineClassification([{ classify: config }]);
    const avif = invalidInlineClassification([{ format: "avif", classify: config }]);

    expect(missing).toContain("jpeg, png or webp");
    expect(avif).toContain("[0]");
  });

  test("rejects discarding without classification or together with an output path", () => {
    const alone = invalidInlineClassification([{ format: "jpeg", discard: true }]);
    const withOutput = invalidInlineClassification([
      { format: "jpeg", classify: config, discard: true, output: "/tmp/x.jpg" },
    ]);

    expect(alone).toContain("discard requires classify");
    expect(withOutput).toContain("output");
  });

  test("rejects an unsupported candidate set", () => {
    const options = [{ format: "jpeg", classify: { ...config, labels: ["only"] } }];

    const problem = invalidInlineClassification(options);

    expect(problem).toContain("Unsupported classifier");
  });
});

describe("isImageNoOp", () => {
  test("is never a no-op when the output is classified", () => {
    const options = { format: "png" as const, classify: config };

    const noOp = isImageNoOp(options, "png");

    expect(noOp).toBe(false);
  });
});
