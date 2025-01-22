import type { ServeOptions } from "bun";
import { Readable } from "node:stream";
import sharp, { fit, format } from "sharp";

const formats = Object.keys(format) as (keyof typeof format)[];
const fits = Object.keys(fit) as (keyof typeof fit)[];
type Format = (typeof formats)[number];
type Fit = (typeof fits)[number];

export async function startServer() {
  const server = Bun.serve({
    async fetch(req) {
      const { pathname, searchParams } = new URL(req.url);

      if (req.method === "POST" && pathname === "/optimize") {
        const data = await req.formData();
        const file = data.get("file") as File;
        const width = Number(searchParams.get("w")) || undefined;
        const height = Number(searchParams.get("h")) || undefined;
        const format = (searchParams.get("f") as Format | null) ?? "avif";
        const quality = Number(searchParams.get("q")) || undefined;
        const keepMetadata = searchParams.get("km") === "true";
        const keepExif = searchParams.get("ke") === "true";
        const keepIcc = searchParams.get("ki") === "true";
        const fit = (searchParams.get("fit") as Fit | null) ?? "inside";
        const colorspace = searchParams.get("cs");
        const stream = file.stream();

        let processImage = sharp()
          .resize({ width, height, fit })
          .toFormat(format, { quality });
        if (keepMetadata) processImage = processImage.keepMetadata();
        if (keepExif) processImage = processImage.keepExif();
        if (keepIcc) processImage = processImage.keepIccProfile();
        if (colorspace) processImage = processImage.toColorspace(colorspace);
        return new Response(
          readableToWeb(readableFromWeb(stream).pipe(processImage))
        );
      }
    },
  } as ServeOptions);

  console.log(`Server is running on http://${server.hostname}:${server.port}`);

  return server;
}

// Somehow current bun / node types don't match with TS lib types for ReadableStream, so we need to cast to any.
function readableFromWeb(stream: ReadableStream) {
  return Readable.fromWeb(stream as any);
}

function readableToWeb(stream: Readable) {
  return Readable.toWeb(stream) as unknown as ReadableStream;
}
