import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { ProcessedFile } from "@m4k/common";
import { embeddedPreviewFixture } from "../../../../fixtures/embedded-preview.js";
import { extractEmbeddedPreview } from "./extract-embedded-preview.js";
import { processImage } from "./image-processor.js";

const jpeg = () =>
  sharp({ create: { width: 32, height: 16, channels: 3, background: "red" } })
    .jpeg()
    .toBuffer();

describe("extractEmbeddedPreview", () => {
  test("extracts an independent JPEG with the source orientation", async () => {
    const input = embeddedPreviewFixture(await jpeg());
    const before = Buffer.from(input);

    const preview = await extractEmbeddedPreview(input);
    const metadata = await sharp(preview).metadata();

    expect(metadata.format).toBe("jpeg");
    expect(metadata.orientation).toBe(6);
    expect(input.equals(before)).toBe(true);
  });

  test("transforms the embedded preview with orientation applied and metadata removed", async () => {
    const input = embeddedPreviewFixture(await jpeg());
    let output: Buffer | undefined;

    for await (const value of processImage(
      (async function* () {
        yield input;
      })(),
      { embeddedPreview: true, format: "jpeg", resize: { width: 8, height: 8 } },
    )!) {
      if (value instanceof ProcessedFile) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of value.stream!) chunks.push(chunk);
        output = Buffer.concat(chunks);
      }
    }
    const metadata = await sharp(output!).metadata();

    expect(metadata.width).toBe(4);
    expect(metadata.height).toBe(8);
    expect(metadata.orientation).toBeUndefined();
  });

  test("fails visibly when no embedded JPEG exists instead of developing or passing through the source", async () => {
    const input = embeddedPreviewFixture(new Uint8Array());

    const result = extractEmbeddedPreview(input);

    expect(result).rejects.toThrow("No supported embedded JPEG preview");
  });

  test("rejects a regular image selected as a RAW preview input", async () => {
    const input = await jpeg();

    const result = extractEmbeddedPreview(input);

    expect(result).rejects.toThrow("TIFF-based");
  });
});
