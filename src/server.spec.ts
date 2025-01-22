import { describe, expect, it } from "bun:test";
import { testClient } from "hono/testing";
import { app } from "./server";

describe("server", () => {
  const client = testClient(app);

  it("should process image", async () => {
    const response = await client.images.process.$post({
      form: { file: Bun.file("fixtures/image.jpeg") },
      query: { width: "100", height: "1000" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/avif");
    const blob = await response.blob();

    expect(blob.size).toBe(500);
  });

  it("should return 400 if format is invalid", async () => {
    const response = await client.images.process.$post({
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
