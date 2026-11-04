// Copied into an isolated production-only consumer by package-smoke.sh.
import assert from "node:assert/strict";
import { ProcessedFile } from "@m4k/common";
import { classifyImage as classifyRemote } from "@m4k/client";
import { classifyImage, processAudio, processImage } from "m4k";

const fixtures = Bun.argv[2];
assert(fixtures, "Fixture directory is required");
assert.equal(process.env.FFMPEG_PATH, undefined);
assert.equal(process.env.NODE_PATH, undefined);
assert.equal(typeof classifyImage, "function");
assert.equal(typeof classifyRemote, "function");

const images = processImage(`${fixtures}/image.jpeg`, { format: "webp" });
assert(images);
let imageOutputs = 0;
for await (const part of images) {
  if (!(part instanceof ProcessedFile)) continue;
  assert.equal(part.type, "image/webp");
  assert(part.stream);
  let size = 0;
  for await (const chunk of part.stream) size += chunk.byteLength;
  assert(size > 0);
  imageOutputs++;
}
assert.equal(imageOutputs, 1);

const audio = processAudio(`${fixtures}/audio.mp3`, { format: "ogg", codec: "libvorbis" });
assert(audio);
let audioOutputs = 0;
for await (const part of audio) {
  if (!(part instanceof ProcessedFile)) continue;
  assert.equal(part.type, "audio/ogg");
  assert(Bun.file(part.name).size > 0);
  audioOutputs++;
}
assert.equal(audioOutputs, 1);
console.log(
  "Package smoke passed: isolated production imports, JPEG → WebP and bundled FFmpeg MP3 → Ogg",
);
