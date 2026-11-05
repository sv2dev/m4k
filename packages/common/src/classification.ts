/** Closed, immutable classifier profile. Changing weights, runtime, prompt or preprocessing needs a new version. */
export const imageClassifier = {
  id: "clip-image-labels",
  version: "1",
  model: "Xenova/clip-vit-base-patch32",
  revision: "6b7c523703ae26e39be4b03774966f8571c7f523",
  template: "This is a photo of {}",
  maxBytes: 8 * 1024 * 1024,
  maxPixels: 1024 * 1024,
  maxLabels: 32,
} as const;

export type ClassificationOptions = {
  classifierId: string;
  classifierVersion: string;
  labels: readonly string[];
};
export type ClassificationResult = {
  classifierId: string;
  classifierVersion: string;
  /** SHA-256 of the exact uploaded representation, not of the decoded image. */
  sha256: string;
  /** Softmax across the complete candidate set, not calibrated independent probabilities. */
  labels: { label: string; score: number }[];
};

/** ASCII-safe JSON for HTTP byte-string headers, preserving arbitrary Unicode label text. */
export function encodeOptions(value: unknown): string {
  return JSON.stringify(value).replace(
    /[^\u0020-\u007e]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

export function validateClassificationOptions(value: unknown): value is ClassificationOptions {
  if (!value || typeof value !== "object") return false;
  const o = value as ClassificationOptions;
  return (
    o.classifierId === imageClassifier.id &&
    o.classifierVersion === imageClassifier.version &&
    Array.isArray(o.labels) &&
    o.labels.length >= 2 &&
    o.labels.length <= imageClassifier.maxLabels &&
    new Set(o.labels).size === o.labels.length &&
    o.labels.every(
      (label: unknown) =>
        typeof label === "string" &&
        label.length > 0 &&
        label.length <= 80 &&
        label === label.trim() &&
        !/[\u0000-\u001f\u007f{}]/.test(label),
    )
  );
}

/** Profile advertised in `GET /info` `imageProfiles` by servers that classify inside `/images/process`. */
export const inlineClassificationProfile = "inline-classification/1";

/** Image formats the classifier accepts; an inline classification must produce one of them. */
export const classifiableFormats = ["jpeg", "png", "webp"] as const;

/** One classification streamed by `/images/process`: the result for the output at `index`. */
export type InlineClassification = {
  classification: ClassificationResult & {
    /** Position of the producing entry in the request's options array. */
    index: number;
  };
};

/**
 * Checks the classification-related fields of an image-options array before any work starts.
 * Returns the problem, or `undefined` when the combination is acceptable.
 */
export function invalidInlineClassification(
  options: readonly {
    classify?: unknown;
    discard?: boolean;
    format?: string;
    ext?: string;
    output?: string;
  }[],
): string | undefined {
  for (const [index, option] of options.entries()) {
    const at = `[${index}] `;
    if (option.classify === undefined) {
      if (option.discard) return `${at}discard requires classify`;
      continue;
    }
    if (!validateClassificationOptions(option.classify))
      return `${at}Unsupported classifier configuration`;
    const format = option.ext ?? option.format;
    if (!(classifiableFormats as readonly (string | undefined)[]).includes(format))
      return `${at}classify requires an explicit jpeg, png or webp output format`;
    if (option.discard && option.output) return `${at}discard cannot be combined with output`;
  }
  return undefined;
}

/** Whether a result is well-formed for the requested candidates. The byte hash is checked by the caller. */
export function isValidClassificationResult(
  result: ClassificationResult,
  options: ClassificationOptions,
): boolean {
  return (
    result.classifierId === options.classifierId &&
    result.classifierVersion === options.classifierVersion &&
    /^[a-f0-9]{64}$/.test(result.sha256) &&
    Array.isArray(result.labels) &&
    result.labels.length === options.labels.length &&
    new Set(result.labels.map((entry) => entry.label)).size === options.labels.length &&
    result.labels.every(
      (entry) =>
        options.labels.includes(entry.label) &&
        Number.isFinite(entry.score) &&
        entry.score >= 0 &&
        entry.score <= 1,
    ) &&
    Math.abs(result.labels.reduce((sum, entry) => sum + entry.score, 0) - 1) <= 1e-3
  );
}
