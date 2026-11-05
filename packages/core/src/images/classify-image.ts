import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  imageClassifier,
  validateClassificationOptions,
  type ClassificationOptions,
  type ClassificationResult,
} from "@m4k/common";

import { waitForLoad } from "../util/wait-for-load.js";
import { acquireInferenceSlot, releaseInferenceSlot } from "./inference-slot.js";

let classifier: Promise<Awaited<ReturnType<typeof loadClassifier>>> | undefined;
async function loadClassifier() {
  const { env, pipeline } = await import("@huggingface/transformers");
  env.cacheDir = process.env.M4K_MODEL_CACHE ?? `${process.env.M4K_TMP_DIR ?? "/tmp/m4k"}/models`;
  return pipeline("zero-shot-image-classification", imageClassifier.model, {
    revision: imageClassifier.revision,
    dtype: "q8",
    device: "cpu",
  });
}

async function decodePreview(input: Uint8Array) {
  try {
    const image = sharp(input, { limitInputPixels: imageClassifier.maxPixels, animated: false });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1)
      throw new RangeError("Classification requires a single JPEG, PNG or WebP preview");
    return await image
      .rotate()
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    throw error instanceof RangeError ? error : new RangeError("Invalid classification preview");
  }
}

/**
 * Bounded preview-only inference. No arbitrary models, remote image URLs or file outputs.
 * One inference runs at a time: a second caller fails with "Classifier is busy", unless it passes
 * `wait` to queue for its turn (used by `processImage`, whose conversion has already been paid for).
 */
export async function classifyImage(
  input: Uint8Array,
  options: ClassificationOptions,
  { signal, wait = false }: { signal?: AbortSignal; wait?: boolean } = {},
): Promise<ClassificationResult> {
  if (!validateClassificationOptions(options))
    throw new RangeError("Unsupported classifier configuration");
  if (input.byteLength > imageClassifier.maxBytes)
    throw new RangeError("Classification preview exceeds byte limit");
  const admitted = acquireInferenceSlot(wait, signal);
  const bytes = Uint8Array.from(input);
  const candidates = [...options.labels];
  await admitted;
  try {
    signal?.throwIfAborted();
    const { data, info } = await decodePreview(bytes);
    signal?.throwIfAborted();
    const { RawImage } = await import("@huggingface/transformers");
    classifier ??= loadClassifier().catch((error) => {
      classifier = undefined;
      throw error;
    });
    const run = await waitForLoad(classifier, signal);
    signal?.throwIfAborted();
    const labels = await run(
      new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3),
      candidates,
      {
        hypothesis_template: imageClassifier.template,
      },
    );
    // Native inference cannot be preempted; retain the slot until it stops and discard cancelled results.
    signal?.throwIfAborted();
    return {
      classifierId: imageClassifier.id,
      classifierVersion: imageClassifier.version,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      labels: labels as ClassificationResult["labels"],
    };
  } finally {
    releaseInferenceSlot();
  }
}
