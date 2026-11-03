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
