/**
 * Mapping from file extensions to their corresponding MIME types
 */
export const mimeTypes: Record<string, string> = {
  // Image formats
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  tif: "image/tiff",
  bmp: "image/bmp",
  ico: "image/x-icon",

  // Video formats
  mp4: "video/mp4",
  asx: "video/x-ms-asf",
  asf: "video/x-ms-asf",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  webm: "video/webm",
  m4v: "video/x-m4v",
  mng: "video/x-mng",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  ogv: "video/ogg",
  "3gpp": "video/3gpp",
  "3gp": "video/3gpp",
  ts: "video/mp2t",

  // Audio formats
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  wma: "audio/x-ms-wma",
  m4b: "audio/mp4",
  m4p: "audio/mp4",
  opus: "audio/opus",
  aiff: "audio/aiff",
  alac: "audio/alac",
};
