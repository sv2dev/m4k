import { describe, expect, it } from "bun:test";
import type { OptimizerOptions } from "./image-optimizer";
import { imageRouter } from "./image-router";

const app = imageRouter();

describe("/process", () => {
  it("should process image", async () => {
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
    expect(response.headers.get("content-type")).toBe(
      "image/avif, text/event-stream; charset=utf-8"
    );
    const blob = await response.blob();

    expect(blob.size).toBe(500);
  });

  it("should throw if format is invalid", async () => {
    const query = new URLSearchParams({
      format: "x",
    });
    try {
      await app.handle(
        new Request(`http://localhost:3000/process?${query}`, {
          method: "POST",
          body: Bun.file("fixtures/image.jpeg"),
        })
      );
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as RangeError).message).toBe(
        "[/format] Expected union value"
      );
    }
  });
});

describe("/process/multi", () => {
  it("should throw if no X-Options header is provided", async () => {
    try {
      await app.handle(
        new Request(`http://localhost:3000/process/multi`, {
          method: "POST",
          body: Bun.file("fixtures/image.jpeg"),
        })
      );
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as RangeError).message).toBe(
        "X-Options header is required"
      );
    }
  });

  it("should throw if X-Options header is not valid JSON", async () => {
    try {
      await app.handle(
        new Request(`http://localhost:3000/process/multi`, {
          method: "POST",
          body: Bun.file("fixtures/image.jpeg"),
          headers: { "X-Options": "{" },
        })
      );
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as RangeError).message).toBe(
        "X-Options header is not valid JSON"
      );
    }
  });

  it("should return 400 if X-Options header does not contain valid options", async () => {
    try {
      await app.handle(
        new Request(`http://localhost:3000/process/multi`, {
          method: "POST",
          body: Bun.file("fixtures/image.jpeg"),
          headers: { "X-Options": "{}" },
        })
      );
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as RangeError).message).toBe("Expected array");
    }
  });

  it("should process images", async () => {
    const response = await app.handle(
      new Request(`http://localhost:3000/process/multi`, {
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
