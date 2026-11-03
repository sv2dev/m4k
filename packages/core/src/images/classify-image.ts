import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  imageClassifier,
  validateClassificationOptions,
  type ClassificationOptions,
  type ClassificationResult,
} from "@m4k/common";

let classifier: Promise<Awaited<ReturnType<typeof loadClassifier>>> | undefined;
let busy = false;
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

/** Bounded preview-only inference. No arbitrary models, remote image URLs or file outputs. */
export async function classifyImage(
  input: Uint8Array,
  options: ClassificationOptions,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ClassificationResult> {
  if (!validateClassificationOptions(options))
    throw new RangeError("Unsupported classifier configuration");
  if (input.byteLength > imageClassifier.maxBytes)
    throw new RangeError("Classification preview exceeds byte limit");
  signal?.throwIfAborted();
  if (busy) throw new Error("Classifier is busy");
  busy = true;
  try {
    const bytes = Uint8Array.from(input);
    const candidates = [...options.labels];
    const { data, info } = await decodePreview(bytes);
    signal?.throwIfAborted();
    const { RawImage } = await import("@huggingface/transformers");
    classifier ??= loadClassifier().catch((error) => {
      classifier = undefined;
      throw error;
    });
    const run = await classifier;
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
    busy = false;
  }
}
