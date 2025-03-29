import { ProcessedFile, processVideo } from "m4k";

for await (const value of processVideo(Bun.file("fixtures/video.mp4").name!, [
  {
    ext: "mp4",
    videoCodec: "libx265",
  },
  {
    ext: "avif",
    videoFilters: "scale=320:-1",
    frames: 1,
  },
])!) {
  if (value instanceof ProcessedFile) {
    console.log(value);
    const out = Bun.file(`test.${value.name.split(".").at(-1)}`);
    Bun.write(out, Bun.file(value.name));
  }
}

// for await (const value of processImage(Bun.file("fixtures/image.jpeg"), {
//   format: "jpeg",
//   quality: 40,
// })!) {
//   if (value instanceof Blob) {
//     const file = Bun.file("test.jpeg");
//     const writer = file.writer();
//     for await (const chunk of value.stream() as unknown as AsyncIterable<Uint8Array>) {
//       writer.write(chunk);
//       await writer.flush();
//     }
//     await writer.end();
//   } else {
//     console.log(value);
//   }
// }
