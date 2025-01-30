import { describe, expect, it } from "bun:test";
import { processVideo } from "./video-router";

describe("/process", () => {
  it("should process a video", async () => {
    const query = new URLSearchParams({
      format: "mp4",
    });
    const response = await processVideo(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    const blob = await response.blob();
    Bun.sleep(1);
    expect(await Bun.file("/tmp/output.mp4").exists()).toBe(false);
    expect(blob.size).toBe(1055835);
  });

  it("should not stream back, if output is provided", async () => {
    const query = new URLSearchParams({
      format: "mp4",
      output: "/tmp/test-output.mp4",
    });
    const response = await processVideo(
      new Request(`http://localhost:3000/process?${query}`, {
        method: "POST",
        body: Bun.file("fixtures/video.mp4"),
      })
    );

    expect(response.status).toBe(201);
    const blob = await response.blob();
    expect(blob.size).toBe(0);
    const outFile = Bun.file("/tmp/test-output.mp4");
    Bun.write("foo.mp4", await outFile.arrayBuffer());
    expect(outFile.size).toBe(1055835);
    await outFile.unlink();
  });
});
