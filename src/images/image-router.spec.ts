import { describe, expect, it } from "bun:test";
import type { OptimizerOptions } from "./image-optimizer";
import { imageRouter } from "./image-router";

const app = imageRouter();

describe("/process", () => {
  it("should process a single image", async () => {
    const query = new URLSearchParams({
      width: "100",
      height: "1000",
    });
    const response = await app.handle(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(
      /^multipart\/form-data; boundary=/
    );
    const data = await response.formData();
    expect((data.get("file1") as File).size).toBe(502);
  });

  it("should stream the queue position", async () => {
    const query = new URLSearchParams({
      width: "100",
      height: "1000",
    });
    const r1 = app.handle(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
      })
    );
    const r2 = app.handle(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
      })
    );

    const [buf1, buf2] = await Promise.all([
      (await r1).arrayBuffer(),
      (await r2).arrayBuffer(),
    ]);

    expect(new TextDecoder().decode(buf1)).toInclude(
      JSON.stringify({ position: 1 })
    );
    expect(new TextDecoder().decode(buf2)).toInclude(
      JSON.stringify({ position: 2 })
    );
  });

  it("should throw if format is invalid", async () => {
    const query = new URLSearchParams({
      format: "x",
    });
    const res = await app.handle(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
      })
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        property: "/format",
        message: "Expected union value",
      })
    );
  });

  it("should return 400 if no options are provided", async () => {
    const res = await app.handle(
      new Request(`http://localhost:3000/process`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
      })
    );

    expect(res.status).toBe(400);
    expect(await res.text()).toBe("No options provided");
  });

  it("should return 400 if X-Options header is not valid JSON", async () => {
    const res = await app.handle(
      new Request(`http://localhost:3000/process`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
        headers: { "X-Options": "{" },
      })
    );

    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Error while parsing options");
  });

  it("should process multiple images", async () => {
    const response = await app.handle(
      new Request(`http://localhost:3000/process`, {
        method: "POST",
        body: Bun.file("fixtures/image.jpeg"),
        headers: {
          "X-Options": JSON.stringify([
            { format: "avif", quality: 40 },
            { format: "webp", quality: 40 },
          ] satisfies OptimizerOptions[]),
        },
      })
    );

    const formData = await response.formData();
    const file1 = formData.get("file1") as File;
    const file2 = formData.get("file2") as File;
    const blob1 = await file1.arrayBuffer();
    const blob2 = await file2.arrayBuffer();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(
      /^multipart\/form-data; boundary=/
    );
    expect(file1.type).toBe("image/avif");
    expect(file2.type).toBe("image/webp");
    expect(file1.name).toBe("file1.avif");
    expect(file2.name).toBe("file2.webp");
    expect(blob1.byteLength).toBe(992);
    expect(blob2.byteLength).toBe(1412);
  });
});
