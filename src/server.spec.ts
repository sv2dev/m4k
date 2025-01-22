import type { Server } from "bun";
import { afterAll, beforeAll, describe, it } from "bun:test";
import { startServer } from "./server";

let server: Server;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("server", () => {
  it("should process image", async () => {
    const data = new FormData();
    data.append("file", Bun.file("fixtures/image.jpeg"));
    const response = await fetch(
      "http://localhost:3000/optimize?w=100&h=1000&f=avif",
      {
        method: "POST",
        body: data,
      }
    );

    Bun.write(Bun.file(".tmp/test/image.avif"), response);
  });
});
