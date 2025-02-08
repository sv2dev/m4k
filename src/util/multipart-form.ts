const textEncoder = new TextEncoder();

export const FILE_BOUNDARY = `file-boundary-${Bun.randomUUIDv7("base64url")}`;
const LINE_BREAK = "\r\n";

export function fileBoundary(opts: {
  first?: boolean;
  name?: string;
  filename?: string;
  contentType?: string;
}): Uint8Array;
export function fileBoundary(): Uint8Array;
export function fileBoundary({
  first,
  name,
  filename,
  contentType,
}: {
  first?: boolean;
  name?: string;
  filename?: string;
  contentType?: string;
} = {}) {
  const last = !first && !name && !filename && !contentType;
  const lines: string[] = [
    ...(!last
      ? [
          `--${FILE_BOUNDARY}`,
          ...(name || filename
            ? [
                [
                  `Content-Disposition: form-data`,
                  ...(name ? [`name="${name}"`] : []),
                  ...(filename ? [`filename="${filename}"`] : []),
                ].join("; "),
              ]
            : []),
          ...(contentType ? [`Content-Type: ${contentType}`] : []),
          LINE_BREAK,
        ]
      : [`--${FILE_BOUNDARY}--${LINE_BREAK}`]),
  ];
  return textEncoder.encode(
    `${first ? "" : LINE_BREAK}${lines.join(LINE_BREAK)}`
  );
}
