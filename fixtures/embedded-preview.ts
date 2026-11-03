/** Synthetic little-endian TIFF/DNG metadata with an IFD1 JPEG, not a camera RAW decoder fixture. */
export function embeddedPreviewFixture(jpeg: Uint8Array, orientation = 6): Buffer {
  const offset = 8 + 2 + 2 * 12 + 4;
  const dataOffset = offset + 2 + 5 * 12 + 4;
  const bytes = Buffer.alloc(dataOffset + jpeg.length);
  bytes.write("II");
  bytes.writeUInt16LE(42, 2);
  bytes.writeUInt32LE(8, 4);
  bytes.writeUInt16LE(2, 8);
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    bytes.writeUInt16LE(tag, at);
    bytes.writeUInt16LE(type, at + 2);
    bytes.writeUInt32LE(count, at + 4);
    bytes.writeUInt32LE(value, at + 8);
  };
  entry(10, 0x112, 3, 1, orientation);
  entry(22, 0xc612, 1, 4, 0x00000401);
  bytes.writeUInt32LE(offset, 34);
  bytes.writeUInt16LE(5, offset);
  entry(offset + 2, 0x100, 4, 1, 32);
  entry(offset + 14, 0x101, 4, 1, 16);
  entry(offset + 26, 0x103, 3, 1, 6);
  entry(offset + 38, 0x201, 4, 1, dataOffset);
  entry(offset + 50, 0x202, 4, 1, jpeg.length);
  bytes.set(jpeg, dataOffset);
  return bytes;
}
