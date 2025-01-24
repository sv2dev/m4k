import { describe, expect, it } from "bun:test";
import { testClient } from "hono/testing";
import type { OptimizerOptions } from "./image-optimizer";
import { imageRouter } from "./image-router";

const client = testClient(imageRouter);

describe("/process", () => {
  it("should process image", async () => {
    const response = await client.process.$post({
      form: { file: Bun.file("fixtures/image.jpeg") },
      query: { width: "100", height: "1000" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/avif");
    const blob = await response.blob();

    expect(blob.size).toBe(500);
  });

  it("should return 400 if format is invalid", async () => {
    const response = await client.process.$post({
      form: { file: Bun.file("fixtures/image.jpeg") },
      query: { format: "x" as any },
    });

    expect(response.status).toBe(400);
    const {
      errors: [error],
    } = (await response.json()) as any;
    expect(error).toMatchObject({
      path: "/format",
      value: "x",
      message: "Expected union value",
    });
  });
});

describe("/process/multi", () => {
  it("should return 400 if no X-Options header is provided", async () => {
    const response = await client.process.multi.$post({
      form: { file: Bun.file("fixtures/image.jpeg") },
      header: { "X-Options": "" },
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("X-Options header is required");
  });

  it("should return 400 if X-Options header is not valid JSON", async () => {
    const response = await client.process.multi.$post({
      form: { file: Bun.file("fixtures/image.jpeg") },
      header: { "X-Options": "{" },
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("X-Options header is not valid JSON");
  });

  it("should return 400 if X-Options header does not contain valid options", async () => {
    const response = await client.process.multi.$post({
      form: { file: Bun.file("fixtures/image.jpeg") },
      header: { "X-Options": "{}" },
    });

    expect(response.status).toBe(400);
    expect(await response.text()).toEqual("Expected array");
  });

  it("should process images", async () => {
    const response = await client.process.multi.$post({
      form: { file: Bun.file("fixtures/image.jpeg") },
      header: {
        "X-Options": JSON.stringify([
          { format: "avif", quality: 40 },
          { format: "webp", quality: 40 } as OptimizerOptions,
        ]),
      },
    });

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
    expect(blob1.byteLength).toBe(969);
    expect(blob2.byteLength).toBe(1412);
  });
});
