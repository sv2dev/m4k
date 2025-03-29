export type Progress = {
  progress: number;
};

export type QueuePosition = {
  position: number;
};

export type ProcessingError = {
  error: string;
};

export type ImageOptions = {
  /** The rotation of the image. If not provided, the image will be auto-rotated, according to the EXIF data. To disable auto-rotation, set to `0`. */
  rotate?: number;
  /** Resizing options. */
  resize?: {
    /** The width of the image. */
    width?: number;
    /** The height of the image. */
    height?: number;
    /** The way to resize the image. */
    fit?: "contain" | "cover" | "fill" | "inside" | "outside";
  };
  /** The format of the output file. */
  format?:
    | "avif"
    | "jpeg"
    | "png"
    | "webp"
    | "tiff"
    | "dz"
    | "ppm"
    | "fits"
    | "gif"
    | "svg"
    | "heif"
    | "pdf"
    | "jp2";
  /** The quality of the output file. */
  quality?: number;
  /** Whether to keep the metadata of the image. */
  keepMetadata?: boolean;
  /** Whether to keep the EXIF data of the image. */
  keepExif?: boolean;
  /** Whether to keep the ICC profile of the image. */
  keepIcc?: boolean;
  /** The colorspace of the image. */
  colorspace?: string;
  /** The cropping options. */
  crop?: {
    /** The left position of the crop. */
    left?: number;
    /** The top position of the crop. */
    top?: number;
    /** The width of the crop. */
    width: number;
    /** The height of the crop. */
    height: number;
  };
  /** The name of the output file. */
  name?: string;
  /** The output path of the file. */
  output?: string;
};

export type VideoOptions = {
  /** The aspect ratio of the output file. */
  aspect?: number | string;
  /** The bitrate of the audio. */
  audioBitrate?: number | string;
  /** The codec of the audio. */
  audioCodec?: string;
  /** The filters to apply to the audio. */
  audioFilters?: string;
  /** The complex filters to apply to the video. */
  complexFilters?: string;
  /** The duration of the output file. */
  duration?: number | string;
  /** The extension of the output file. */
  ext?: string;
  /** The format of the output file. If no extension is provided, it will be inferred from the format. */
  format?: string;
  /** The frames per second of the output file. */
  fps?: number;
  /** The frames to process. */
  frames?: number;
  /** The input format of the video. */
  inputFormat?: string;
  /** The padding of the output file. */
  pad?: string;
  /** The position in the input file to start processing from. */
  seek?: number | string;
  /** The resolution of the output file. */
  size?: string;
  /** The bitrate of the video. */
  videoBitrate?: number | string;
  /** The codec of the video. */
  videoCodec?: string;
  /** The filters to apply to the video. */
  videoFilters?: string;
  /** The name of the output file. */
  name?: string;
  /** The output path of the file. */
  output?: string;
};

export type AudioOptions = {
  /** The bitrate of the audio. */
  bitrate?: number | string;
  /** The codec of the audio. */
  codec?: string;
  /** The complex filters to apply to the audio. */
  complexFilters?: string;
  /** The filters to apply to the audio. */
  filters?: string;
  /** The duration of the output file. */
  duration?: number | string;
  /** The extension of the output file. */
  ext?: string;
  /** The format of the output file. If no extension is provided, it will be inferred from the format. */
  format?: string;
  /** The input format of the audio. */
  inputFormat?: string;
  /** The seek time of the audio. */
  seek?: number | string;
  /** The name of the output file. */
  name?: string;
  /** The output path of the file. */
  output?: string;
};

export class ProcessedFile {
  constructor(
    readonly name: string,
    readonly type: string,
    readonly stream?: AsyncIterable<Uint8Array>
  ) {}
}
