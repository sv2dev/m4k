import { imageClassifier, inlineClassificationProfile, ProcessedFile } from "@m4k/common";
import { describe, expect, test } from "bun:test";
import { processImage } from "./client.js";

const classify = {
  classifierId: imageClassifier.id,
  classifierVersion: imageClassifier.version,
  labels: ["landscape", "receipt"],
};
const sha256 = "a".repeat(64);
const result = (index: number) => ({
  index,
  classifierId: imageClassifier.id,
  classifierVersion: imageClassifier.version,
  sha256,
  labels: [
    { label: "landscape", score: 0.75 },
    { label: "receipt", score: 0.25 },
  ],
});

/** A fake m4k: `/info` plus a canned multipart answer for `/images/process`. */
function fakeServer(options: {
  profiles?: string[];
  parts: (string | { json: unknown })[];
  posts?: { count: number };
}) {
  const boundary = "test-boundary";
  return Bun.serve({
    port: 0,
    fetch(request) {
      if (request.method === "GET")
        return Response.json({
          service: "m4k",
          classifiers: [imageClassifier],
          imageProfiles: options.profiles ?? [inlineClassificationProfile],
        });
      if (options.posts) options.posts.count++;
      const body = options.parts
        .map((part) =>
          typeof part === "string"
            ? `--${boundary}\r\nContent-Disposition: attachment; filename="${part}"\r\nContent-Type: image/jpeg\r\n\r\nbytes\r\n`
            : `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(part.json)}\r\n`,
        )
        .join("");
      return new Response(`${body}--${boundary}--\r\n`, {
        headers: { "content-type": `multipart/mixed; boundary="${boundary}"` },
      });
    },
  });
}

async function run(host: string, opts: Parameters<typeof processImage>[2]) {
  const events: unknown[] = [];
  for await (const event of processImage(host, new Blob(["input"], { type: "image/png" }), opts)) {
    if (event instanceof ProcessedFile) {
      await Array.fromAsync(event.stream!);
      events.push(`file:${event.name}`);
    } else events.push(event);
  }
  return events;
}

describe("processImage() with classification", () => {
  test("yields the classification after the file it belongs to", async () => {
    const server = fakeServer({
      parts: ["file1.jpeg", { json: { classification: result(0) } }, "file2.webp"],
    });

    const events = await run(server.url.origin, [
      { format: "jpeg", classify },
      { format: "webp" },
    ]).finally(() => server.stop(true));

    expect(events).toEqual(["file:file1.jpeg", { classification: result(0) }, "file:file2.webp"]);
  });

  test("does not upload to a server without inline classification", async () => {
    const posts = { count: 0 };
    const server = fakeServer({ profiles: ["embedded-preview/1"], parts: [], posts });

    const error = await run(server.url.origin, { format: "jpeg", classify }).then(
      () => null,
      (e: unknown) => e,
    );
    server.stop(true);

    expect(error).toBeInstanceOf(RangeError);
    expect(posts.count).toBe(0);
  });

  test("fails when the server omits a requested classification", async () => {
    const server = fakeServer({ parts: ["file1.jpeg"] });

    const error = await run(server.url.origin, { format: "jpeg", classify }).then(
      () => null,
      (e: unknown) => e,
    );
    server.stop(true);

    expect(String(error)).toContain("every requested classification");
  });

  test("rejects a classification for candidates that were not requested", async () => {
    const forged = { ...result(0), labels: [{ label: "dog", score: 1 }] };
    const server = fakeServer({ parts: [{ json: { classification: forged } }] });

    const error = await run(server.url.origin, { format: "jpeg", classify, discard: true }).then(
      () => null,
      (e: unknown) => e,
    );
    server.stop(true);

    expect(String(error)).toContain("Invalid classification response");
  });

  test("rejects a classification for an entry that did not ask for one", async () => {
    const server = fakeServer({ parts: [{ json: { classification: result(1) } }] });

    const error = await run(server.url.origin, [
      { format: "jpeg", classify, discard: true },
      { format: "webp" },
    ]).then(
      () => null,
      (e: unknown) => e,
    );
    server.stop(true);

    expect(String(error)).toContain("Invalid classification response");
  });

  test("refuses an avif output before contacting the server", async () => {
    const options = { format: "avif" as const, classify };

    const error = await run("http://127.0.0.1:1", options).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(RangeError);
  });

  test("never short-circuits a classifying entry as a no-op conversion", async () => {
    const server = fakeServer({
      parts: ["file1.png", { json: { classification: result(0) } }],
    });

    const events = await run(server.url.origin, { format: "png", classify }).finally(() =>
      server.stop(true),
    );

    expect(events).toContainEqual({ classification: result(0) });
  });
});
