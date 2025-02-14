import { streamParts } from "@sv2dev/multipart-stream";

const res = await fetch(
  `http://localhost:3000/videos/process?${new URLSearchParams({
    format: "mp4",
    videoCodec: "libsvtav1",
  })}`,
  {
    method: "POST",
    body: Bun.file("fixtures/video.mp4"),
  }
);

const [, video] = await Array.fromAsync(streamParts(res));

await Bun.write("test.mp4", await video.bytes());

const res2 = await fetch(
  `http://localhost:3000/images/process?${new URLSearchParams({
    format: "avif",
  })}`,
  {
    method: "POST",
    body: Bun.file("fixtures/image.jpeg"),
  }
);

const [, image] = await Array.fromAsync(streamParts(res2));

await Bun.write("test.avif", await image.bytes());
