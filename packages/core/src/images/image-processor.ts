import {
  type ImageOptions,
  type InlineClassification,
  ProcessedFile,
  invalidInlineClassification,
  isImageNoOp,
} from "@m4k/common";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import sharp from "sharp";
import { createQueue } from "tasque";
import { ffmpeg, createTmp, randomId } from "../util/ffmpeg-processor.js";
import { exhaustAsyncIterableToWritable } from "../util/streams.js";

import { classifyImage } from "./classify-image.js";
import { extractEmbeddedPreview } from "./extract-embedded-preview.js";

export { ffmpeg };

export type Format = Required<ImageOptions>["format"];
export type Fit = Required<Required<ImageOptions>["resize"]>["fit"];

const imageTmpDir = `${process.env.M4K_TMP_DIR ?? "/tmp/m4k"}/image`;

/**
 * Process an image.
 * @param input - The input image. Can be a file path, a stream or a blob.
 * @param opts - The options for the image processing.
 * @param signal - An optional abort signal.
 * @returns An iterable of the processed images. An entry with `classify` is followed by an
 * `InlineClassification` of exactly its output bytes; the file itself is omitted if `discard` is set.
 */
export function processImage(
  input: string | AsyncIterable<Uint8Array> | Blob,
  opts: ImageOptions | ImageOptions[],
  { signal }: { signal?: AbortSignal } = {},
) {
  const iterable = imageQueue.iterate(async function* () {
    const optsArr = Array.isArray(opts) ? opts : [opts];
    const invalid = invalidInlineClassification(optsArr);
    if (invalid) throw new RangeError(invalid);
    const preview = optsArr.some((o) => o.embeddedPreview);
    if (
      preview &&
      optsArr.some((o) => !o.embeddedPreview || o.keepMetadata || o.keepExif || o.keepIcc)
    )
      throw new RangeError(
        "Embedded previews require metadata stripping and cannot mix input modes",
      );
    const resolvedInput = preview
      ? await extractEmbeddedPreview(await boundedInput(input))
      : await resolveInput(input);
    const inputExt = detectExt(resolvedInput);

    if (inputExt != null && optsArr.every((o) => isImageNoOp(o, inputExt))) {
      yield { progress: 0 };
      const bytes = await toBytes(resolvedInput);
      for (let i = 0; i < optsArr.length; i++) {
        const ext = optsArr[i].ext ?? optsArr[i].format ?? inputExt;
        yield new ProcessedFile(`file${i + 1}.${ext}`, `image/${ext}`, toAsyncIterable(bytes));
        yield { progress: Math.round(((i + 1) / optsArr.length) * 100) };
      }
      return;
    }

    let files: OutputFile[];
    try {
      files = await runSharp(resolvedInput, optsArr);
    } catch {
      const png = await ffmpegDecodeToPng(resolvedInput);
      files = await runSharp(png, optsArr);
    }

    yield { progress: 0 };
    for (let i = 0; i < files.length; i++) {
      const { name, type, bytes } = files[i];
      const { classify, discard } = optsArr[i];
      if (!discard) yield new ProcessedFile(name, type, toAsyncIterable(bytes));
      if (classify) {
        // Queues for the single inference slot: the conversion above is not repeated when busy.
        const result = await classifyImage(bytes, classify, {
          ...(signal ? { signal } : {}),
          wait: true,
        });
        yield { classification: { index: i, ...result } } satisfies InlineClassification;
      }
      yield { progress: Math.round(((i + 1) / files.length) * 100) };
    }
  }, signal);
  if (!iterable) return null;
  return (async function* () {
    for await (const [position, value] of iterable) {
      if (position !== null) yield { position };
      else yield value;
    }
  })();
}

/**
 * The queue for image processing.
 */
export const imageQueue = createQueue({
  parallelize: Number(process.env.IMAGE_PARALLELIZE ?? 5),
  max: Number(process.env.IMAGE_QUEUE_SIZE ?? 100),
});

type OutputFile = { name: string; type: string; bytes: Buffer };

/** Convert sibling outputs and retain their exact encoded bytes for optional classification. */
async function runSharp(
  input: string | Buffer | Blob,
  opts: ImageOptions[],
): Promise<OutputFile[]> {
  const sharpInstance = sharp();
  void exhaustAsyncIterableToWritable(toSharpInput(input), sharpInstance);
  return Promise.all(
    opts.map(
      async (
        {
          colorspace,
          crop,
          format = "avif",
          ext = format,
          keepExif,
          keepIcc,
          keepMetadata,
          quality,
          resize,
          rotate,
        },
        idx,
      ) => {
        let s = sharpInstance.clone();
        s = s.rotate(rotate);
        if (resize)
          s = s.resize({
            ...resize,
            fit: resize.fit ?? "inside",
          });
        if (keepMetadata) s = s.keepMetadata();
        if (keepExif) s = s.keepExif();
        if (keepIcc) s = s.keepIccProfile();
        if (colorspace) s = s.toColorspace(colorspace);
        if (crop) {
          s = s.extract({
            ...crop,
            left: crop.left ?? 0,
            top: crop.top ?? 0,
          });
        }
        s = s.toFormat(ext, { quality });
        return { name: `file${idx + 1}.${ext}`, type: `image/${ext}`, bytes: await s.toBuffer() };
      },
    ),
  );
}

async function ffmpegDecodeToPng(input: string | Buffer | Blob): Promise<Buffer> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(imageTmpDir, { recursive: true });
  const id = randomId();
  const outPath = `${imageTmpDir}/out-${id}.png`;
  const inputPath =
    typeof input === "string"
      ? input
      : await createTmp(
          imageTmpDir,
          id,
          input instanceof Buffer ? toAsyncIterable(input) : (input as Blob),
        );
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        ffmpeg,
        ["-y", "-i", inputPath, "-update", "1", "-frames:v", "1", outPath],
        {
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let errStr = "";
      child.stderr!.on("data", (chunk: Buffer) => {
        errStr += chunk.toString();
      });
      child.on("close", (code) => {
        if (code !== 0) reject(new Error(`ffmpeg exited with code ${code}: ${errStr}`));
        else resolve();
      });
    });
    return await readFile(outPath);
  } finally {
    await rm(outPath, { force: true });
    if (typeof input !== "string") await rm(inputPath, { force: true });
  }
}

async function boundedInput(input: string | AsyncIterable<Uint8Array> | Blob): Promise<Buffer> {
  const iterable =
    typeof input === "string"
      ? createReadStream(input)
      : "stream" in input
        ? input.stream()
        : input;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of iterable) {
    size += chunk.length;
    if (size > 128 * 1024 * 1024) throw new RangeError("RAW preview input exceeds 128 MiB");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function resolveInput(
  input: string | AsyncIterable<Uint8Array> | Blob,
): Promise<string | Buffer | Blob> {
  if (typeof input === "string" || "stream" in input) return input as string | Blob;
  const chunks: Uint8Array[] = [];
  for await (const chunk of input) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function toBytes(input: string | Buffer | Blob): Promise<Buffer> {
  if (input instanceof Buffer) return input;
  if (typeof input === "string") return readFile(input);
  const blob = input as Blob;
  return Buffer.from(await blob.arrayBuffer());
}

function toSharpInput(input: string | Buffer | Blob): AsyncIterable<Uint8Array> {
  if (typeof input === "string") return createReadStream(input) as any;
  if ("stream" in input) return input.stream() as any;
  return toAsyncIterable(input as Buffer);
}

// eslint-disable-next-line typescript/require-await
async function* toAsyncIterable(buf: Buffer | Uint8Array): AsyncIterable<Uint8Array> {
  yield new Uint8Array(buf instanceof Buffer ? buf : buf);
}

function detectExt(input: string | Buffer | Blob): string | null {
  if (typeof input === "string") {
    const dot = input.lastIndexOf(".");
    return dot !== -1 ? input.slice(dot + 1).toLowerCase() : null;
  }
  if ("type" in input && input.type) {
    const mime = input.type;
    if (mime === "image/avif" || mime === "image/heif") return "avif";
    const slash = mime.lastIndexOf("/");
    return slash !== -1 ? mime.slice(slash + 1).toLowerCase() : null;
  }
  if (input instanceof Buffer && input.byteLength >= 12) {
    if (input[0] === 0xff && input[1] === 0xd8) return "jpeg";
    if (input[0] === 0x89 && input[1] === 0x50 && input[2] === 0x4e && input[3] === 0x47)
      return "png";
    if (input[0] === 0x47 && input[1] === 0x49 && input[2] === 0x46) return "gif";
    if (
      input[0] === 0x52 &&
      input[1] === 0x49 &&
      input[2] === 0x46 &&
      input[3] === 0x46 &&
      input[8] === 0x57 &&
      input[9] === 0x45 &&
      input[10] === 0x42 &&
      input[11] === 0x50
    )
      return "webp";
    // AVIF/HEIF: ftyp box at offset 4, brand at offset 8
    if (input[4] === 0x66 && input[5] === 0x74 && input[6] === 0x79 && input[7] === 0x70) {
      const brand = input.slice(8, 12).toString("ascii");
      if (brand.startsWith("avif") || brand.startsWith("avis")) return "avif";
      if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("mif1"))
        return "heif";
    }
  }
  return null;
}
