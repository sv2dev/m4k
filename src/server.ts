import { Hono } from "hono";
import { stream } from "hono/streaming";
import { Readable } from "node:stream";
import sharp, { fit, format } from "sharp";

export const app = new Hono().post("/process", async (c) => {
  const { searchParams } = new URL(c.req.url);
  const data = await c.req.formData();
  const file = data.get("file") as File;
  const width = Number(searchParams.get("w")) || undefined;
  const height = Number(searchParams.get("h")) || undefined;
  const format = (searchParams.get("f") as Format | null) ?? "avif";
  const quality = Number(searchParams.get("q")) || undefined;
  const keepMetadata = searchParams.get("km") === "true";
  const keepExif = searchParams.get("ke") === "true";
  const keepIcc = searchParams.get("ki") === "true";
  const fit = (searchParams.get("fit") as Fit | null) ?? "inside";
  const colorspace = searchParams.get("cs") ?? undefined;

  c.header("Content-Type", `image/${format}`);
  try {
    const processImage = setupSharp({
      width,
      height,
      fit,
      format,
      quality,
      keepMetadata,
      keepExif,
      keepIcc,
      colorspace,
    });
    return stream(c, async (stream) => {
      try {
        await stream.pipe(
          readableToWeb(readableFromWeb(file.stream()).pipe(processImage))
        );
      } catch (e) {
        console.warn("Error processing image", (e as Error).message);
        stream.write("Error during streaming image");
      }
    });
  } catch (e) {
    console.warn("Error processing image", (e as Error).message);
    return c.text("Error during image processing", 500);
  }
});

function setupSharp({
  width,
  height,
  fit = "inside",
  format = "avif",
  quality,
  keepMetadata = false,
  keepExif = false,
  keepIcc = false,
  colorspace,
}: {
  width?: number;
  height?: number;
  fit?: Fit;
  format?: Format;
  quality?: number;
  keepMetadata?: boolean;
  keepExif?: boolean;
  keepIcc?: boolean;
  colorspace?: string;
}) {
  let processImage = sharp()
    .resize({ width, height, fit })
    .toFormat(format, { quality });
  if (keepMetadata) processImage = processImage.keepMetadata();
  if (keepExif) processImage = processImage.keepExif();
  if (keepIcc) processImage = processImage.keepIccProfile();
  if (colorspace) processImage = processImage.toColorspace(colorspace);
  return processImage;
}

const formats = Object.keys(format) as (keyof typeof format)[];
const fits = Object.keys(fit) as (keyof typeof fit)[];
type Format = (typeof formats)[number];
type Fit = (typeof fits)[number];

// Somehow current bun / node types don't match with TS lib types for ReadableStream, so we need to cast to any.
function readableFromWeb(stream: ReadableStream) {
  return Readable.fromWeb(stream as any);
}

function readableToWeb(stream: Readable) {
  return Readable.toWeb(stream) as unknown as ReadableStream;
}
