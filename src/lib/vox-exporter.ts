/**
 * MagicaVoxel .vox file exporter
 * Based on the VOX format specification: https://github.com/ephtracy/voxel-model/blob/master/vox-format.txt
 */

export interface Voxel {
  x: number;
  y: number;
  z: number;
  colorIndex: number;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function exportToVox(
  width: number,
  height: number,
  depth: number,
  voxels: Voxel[],
  palette: RGBA[]
): Uint8Array {
  const chunks: Uint8Array[] = [];

  // Helper to write string
  const writeString = (str: string) => {
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
    return arr;
  };

  // Helper to write Int32
  const writeInt32 = (val: number) => {
    const arr = new Uint8Array(4);
    const view = new DataView(arr.buffer);
    view.setInt32(0, val, true); // Little endian
    return arr;
  };

  // Header
  chunks.push(writeString('VOX '));
  chunks.push(writeInt32(150)); // Version

  // SIZE chunk
  const sizeContent = new Uint8Array(12);
  const sizeView = new DataView(sizeContent.buffer);
  sizeView.setInt32(0, width, true);
  sizeView.setInt32(4, height, true);
  sizeView.setInt32(8, depth, true);

  const sizeChunk = new Uint8Array(12 + 12);
  sizeChunk.set(writeString('SIZE'), 0);
  sizeChunk.set(writeInt32(12), 4); // Content size
  sizeChunk.set(writeInt32(0), 8); // Children size
  sizeChunk.set(sizeContent, 12);

  // XYZI chunk
  const xyziContentSize = 4 + voxels.length * 4;
  const xyziContent = new Uint8Array(xyziContentSize);
  const xyziView = new DataView(xyziContent.buffer);
  xyziView.setInt32(0, voxels.length, true);
  for (let i = 0; i < voxels.length; i++) {
    const v = voxels[i];
    xyziView.setUint8(4 + i * 4 + 0, v.x);
    xyziView.setUint8(4 + i * 4 + 1, v.y);
    xyziView.setUint8(4 + i * 4 + 2, v.z);
    xyziView.setUint8(4 + i * 4 + 3, v.colorIndex);
  }

  const xyziChunk = new Uint8Array(12 + xyziContentSize);
  xyziChunk.set(writeString('XYZI'), 0);
  xyziChunk.set(writeInt32(xyziContentSize), 4);
  xyziChunk.set(writeInt32(0), 8);
  xyziChunk.set(xyziContent, 12);

  // RGBA chunk (Palette)
  // Palette is 256 colors, each 4 bytes (RGBA)
  const rgbaContent = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const color = palette[i] || { r: 0, g: 0, b: 0, a: 0 };
    rgbaContent[i * 4 + 0] = color.r;
    rgbaContent[i * 4 + 1] = color.g;
    rgbaContent[i * 4 + 2] = color.b;
    rgbaContent[i * 4 + 3] = color.a;
  }

  const rgbaChunk = new Uint8Array(12 + 1024);
  rgbaChunk.set(writeString('RGBA'), 0);
  rgbaChunk.set(writeInt32(1024), 4);
  rgbaChunk.set(writeInt32(0), 8);
  rgbaChunk.set(rgbaContent, 12);

  // MAIN chunk
  const mainChildrenSize = sizeChunk.length + xyziChunk.length + rgbaChunk.length;
  const mainChunkHeader = new Uint8Array(12);
  mainChunkHeader.set(writeString('MAIN'), 0);
  mainChunkHeader.set(writeInt32(0), 4); // Main has no content
  mainChunkHeader.set(writeInt32(mainChildrenSize), 8);

  // Combine everything
  const totalSize = 8 + mainChunkHeader.length + mainChildrenSize;
  const result = new Uint8Array(totalSize);
  let offset = 0;
  
  // Header
  result.set(writeString('VOX '), offset); offset += 4;
  result.set(writeInt32(150), offset); offset += 4;
  
  // Main
  result.set(mainChunkHeader, offset); offset += 12;
  result.set(sizeChunk, offset); offset += sizeChunk.length;
  result.set(xyziChunk, offset); offset += xyziChunk.length;
  result.set(rgbaChunk, offset); offset += rgbaChunk.length;

  return result;
}
