import { describe, expect, test } from "bun:test";
import { imageClassifier } from "@m4k/common";
import { classifyImage } from "./classify-image.js";

const options = {
  classifierId: imageClassifier.id,
  classifierVersion: imageClassifier.version,
  labels: ["landscape", "receipt"],
};

describe("classifyImage client", () => {
  test("does not upload a preview to an unsupported server", async () => {
    let uploads = 0;
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (request.method === "POST") uploads++;
        return Response.json({ service: "m4k", classifiers: [] });
      },
    });

    const error = await classifyImage(server.url.origin, new Blob(["preview"]), options)
      .then(
        () => null,
        (error: unknown) => error,
      )
      .finally(() => server.stop(true));

    expect(error).toBeInstanceOf(RangeError);
    expect(uploads).toBe(0);
  });

  test("preserves Unicode candidates through HTTP headers", async () => {
    const labels = ["風景", "家族📷"];
    const sha256 = new Bun.CryptoHasher("sha256").update("preview").digest("hex");
    let received: unknown;
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (request.method === "GET")
          return Response.json({ service: "m4k", classifiers: [imageClassifier] });
        received = JSON.parse(request.headers.get("X-Options")!);
        return Response.json({
          classifierId: imageClassifier.id,
          classifierVersion: imageClassifier.version,
          sha256,
          labels: labels.map((label, i) => ({ label, score: i === 0 ? 0.9 : 0.1 })),
        });
      },
    });

    const result = await classifyImage(server.url.origin, new Blob(["preview"]), {
      ...options,
      labels,
    }).finally(() => server.stop(true));

    expect(received).toMatchObject({ labels });
    expect(result.labels.map((entry) => entry.label)).toEqual(labels);
  });

  test("rejects candidate scores that do not sum to one", async () => {
    const sha256 = new Bun.CryptoHasher("sha256").update("preview").digest("hex");
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        return request.method === "GET"
          ? Response.json({ service: "m4k", classifiers: [imageClassifier] })
          : Response.json({
              classifierId: imageClassifier.id,
              classifierVersion: imageClassifier.version,
              sha256,
              labels: options.labels.map((label) => ({ label, score: 0.9 })),
            });
      },
    });

    const error = await classifyImage(server.url.origin, new Blob(["preview"]), options)
      .then(
        () => null,
        (error: unknown) => error,
      )
      .finally(() => server.stop(true));

    expect(error).toMatchObject({ message: "Invalid classification response" });
  });

  test("accepts normalization differences within floating-point tolerance", async () => {
    const sha256 = new Bun.CryptoHasher("sha256").update("preview").digest("hex");
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        return request.method === "GET"
          ? Response.json({ service: "m4k", classifiers: [imageClassifier] })
          : Response.json({
              classifierId: imageClassifier.id,
              classifierVersion: imageClassifier.version,
              sha256,
              labels: options.labels.map((label) => ({ label, score: 0.50000003 })),
            });
      },
    });

    const result = await classifyImage(server.url.origin, new Blob(["preview"]), options).finally(
      () => server.stop(true),
    );

    expect(result.labels).toHaveLength(2);
    expect(result.sha256).toBe(sha256);
  });

  test("rejects labels returned for different uploaded bytes", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        return request.method === "GET"
          ? Response.json({ service: "m4k", classifiers: [imageClassifier] })
          : Response.json({
              classifierId: imageClassifier.id,
              classifierVersion: imageClassifier.version,
              sha256: "0".repeat(64),
              labels: [
                { label: "landscape", score: 0.9 },
                { label: "receipt", score: 0.1 },
              ],
            });
      },
    });

    const error = await classifyImage(server.url.origin, new Blob(["preview"]), options)
      .then(
        () => null,
        (error: unknown) => error,
      )
      .finally(() => server.stop(true));

    expect(error).toMatchObject({ message: "Classification response belongs to different bytes" });
  });
});
