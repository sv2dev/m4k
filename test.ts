import { optimizeImage, optimizeVideo } from "m4k";

for await (const value of optimizeVideo(Bun.file("fixtures/video.mp4"), {
  format: "mp4",
  videoCodec: "libx265",
  output: "test.mp4",
})!) {
  console.log(value);
}

for await (const value of optimizeImage(Bun.file("fixtures/image.jpeg"), {
  format: "jpeg",
  quality: 40,
})!) {
  if (value instanceof Blob) {
    const file = Bun.file("test.jpeg");
    const writer = file.writer();
    for await (const chunk of value.stream() as unknown as AsyncIterable<Uint8Array>) {
      writer.write(chunk);
      await writer.flush();
    }
    await writer.end();
  } else {
    console.log(value);
  }
}
