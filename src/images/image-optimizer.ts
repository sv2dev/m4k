import sharp, { fit, format } from "sharp";

export const formats = Object.keys(format) as (keyof typeof format)[];
export const fits = Object.keys(fit) as (keyof typeof fit)[];
export type Format = (typeof formats)[number];
export type Fit = (typeof fits)[number];

export function createImageOptimizer({
  width,
  height,
  fit = "inside",
  format = "avif",
  quality,
  keepMetadata = false,
  keepExif = false,
  keepIcc = false,
  colorspace,
}: {
  width?: number;
  height?: number;
  fit?: Fit;
  format?: Format;
  quality?: number;
  keepMetadata?: boolean;
  keepExif?: boolean;
  keepIcc?: boolean;
  colorspace?: string;
}) {
  let processImage = sharp()
    .resize({ width, height, fit })
    .toFormat(format, { quality });
  if (keepMetadata) processImage = processImage.keepMetadata();
  if (keepExif) processImage = processImage.keepExif();
  if (keepIcc) processImage = processImage.keepIccProfile();
  if (colorspace) processImage = processImage.toColorspace(colorspace);
  return processImage;
}
