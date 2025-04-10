import { Type as T } from "@sinclair/typebox";

export const audioOptionsSchema = T.Object({
  bitrate: T.Optional(T.Union([T.String(), T.Number()])),
  codec: T.Optional(T.String()),
  complexFilters: T.Optional(T.String()),
  filters: T.Optional(T.String()),
  duration: T.Optional(T.Union([T.String(), T.Number()])),
  ext: T.Optional(T.String()),
  format: T.Optional(T.String()),
  inputFormat: T.Optional(T.String()),
  seek: T.Optional(T.Union([T.String(), T.Number()])),
  name: T.Optional(T.String()),
  output: T.Optional(T.String()),
});

const imageFormat = T.Union([
  T.Literal("avif"),
  T.Literal("jpeg"),
  T.Literal("png"),
  T.Literal("webp"),
  T.Literal("tiff"),
  T.Literal("dz"),
  T.Literal("ppm"),
  T.Literal("fits"),
  T.Literal("gif"),
  T.Literal("svg"),
  T.Literal("heif"),
  T.Literal("pdf"),
  T.Literal("jp2"),
]);
export const imageOptionsSchema = T.Object({
  rotate: T.Optional(T.Number()),
  resize: T.Optional(
    T.Object({
      width: T.Optional(T.Number()),
      height: T.Optional(T.Number()),
      fit: T.Optional(
        T.Union([
          T.Literal("contain"),
          T.Literal("cover"),
          T.Literal("fill"),
          T.Literal("inside"),
          T.Literal("outside"),
        ])
      ),
    })
  ),
  ext: T.Optional(imageFormat),
  format: T.Optional(imageFormat),
  quality: T.Optional(T.Number()),
  keepMetadata: T.Optional(T.Boolean()),
  keepExif: T.Optional(T.Boolean()),
  keepIcc: T.Optional(T.Boolean()),
  colorspace: T.Optional(T.String()),
  crop: T.Optional(
    T.Object({
      left: T.Optional(T.Number()),
      top: T.Optional(T.Number()),
      width: T.Number(),
      height: T.Number(),
    })
  ),
  args: T.Optional(T.Array(T.String())),
  name: T.Optional(T.String()),
  output: T.Optional(T.String()),
});

export const videoOptionsSchema = T.Object({
  audioBitrate: T.Optional(T.Union([T.String(), T.Number()])),
  audioCodec: T.Optional(T.String()),
  audioFilters: T.Optional(T.String()),
  autopad: T.Optional(T.Union([T.Boolean(), T.String()])),
  aspect: T.Optional(T.Union([T.String(), T.Number()])),
  inputFormat: T.Optional(T.String()),
  ext: T.Optional(T.String()),
  format: T.Optional(T.String()),
  fps: T.Optional(T.Number()),
  seek: T.Optional(T.Union([T.String(), T.Number()])),
  size: T.Optional(T.Union([T.String()])),
  videoBitrate: T.Optional(T.Union([T.String(), T.Number()])),
  videoBitrateConstant: T.Optional(T.Boolean()),
  videoCodec: T.Optional(T.String()),
  videoFilters: T.Optional(T.String()),
  args: T.Optional(T.Array(T.String())),
  name: T.Optional(T.String()),
  output: T.Optional(T.String()),
});
