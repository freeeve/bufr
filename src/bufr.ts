import {CacheUtils} from './cacheutils';

const pako = require('pako');
const snappy = require('snappyjs');

/**
 * compression options are zlib and snappy.
 */
export interface BufrOptions {
  allocSizeKb?: number;
  cacheSizeKb?: number;
  compression?: string;
}

export interface Block {
  buffer: Buffer;
  compressed: boolean;
  startOffset: number;
  size: number;
  lastUsed: number;
}

export class Bufr {
  public readonly allocSize: number = 1024 * 4;
  public readonly cacheSize: number = 1024 * 64;
  public readonly compress = snappy.compress;
  public readonly decompress = snappy.uncompress;
  private _length: number = 0;
  private _capacity: number = 0;
  private _uncompressedSize = 0;
  private _totalSize = 0;
  private _compressedSize = 0;
  private blocks: Block[] = [];

  public get length() {
    return this._length;
  }

  public get uncompressedSize() {
    return this._uncompressedSize;
  }

  public get totalSize() {
    return this._totalSize;
  }

  public get compressedSize() {
    return this._compressedSize;
  }

  public get capacity() {
    return this._capacity;
  }

  constructor(options?: BufrOptions) {
    if (options && options.allocSizeKb) {
      this.allocSize = options.allocSizeKb * 1024;
    }
    if (options && options.cacheSizeKb) {
      this.cacheSize = options.cacheSizeKb * 1024;
    }
    if (options && options.compression && options.compression === 'zlib') {
      this.compress = pako.deflateRaw;
      this.decompress = pako.inflateRaw;
    }
    this.pushEmptyBlock();
  }

  public toBuffer(): Buffer {
    return this.subBuffer(0);
  }

  public toString(...options: any[]) {
    return this.toBuffer().toString(...options);
  }

  public static from(something: any, ...options: any[]): Bufr {
    const bufr = new Bufr();
    bufr.writeBuffer(Buffer.from(something, ...options), 0);
    return bufr;
  }

  private compressBlock(block: Block) {
    block.compressed = true;
    this._uncompressedSize -= block.buffer.length;
    this._totalSize -= block.buffer.length;
    block.buffer = Buffer.from(this.compress(block.buffer));
    this._compressedSize += block.buffer.length;
    this._totalSize += block.buffer.length;
  }

  private checkCache() {
    if (this.cacheSize < this.uncompressedSize) {
      const oldestBlockIdx = CacheUtils.findLruBlock(this.blocks);
      this.compressBlock(this.blocks[oldestBlockIdx]);
    }
  }

  public compressAll() {
    this.blocks.forEach((block: Block) => {
      if (!block.compressed) {
        this.compressBlock(block);
      }
    });
  }

  /**
   * reads an 8-bit int at a given offset.
   * @param {number} offset the offset to read from.
   * @returns {number}
   */
  public readInt8(offset: number): number {
    return this.subBuffer(offset, offset + 1).readInt8(0, true);
  }

  public readUInt8(offset: number): number {
    return this.subBuffer(offset, offset + 1).readUInt8(0, true);
  }

  public readInt16LE(offset: number): number {
    return this.subBuffer(offset, offset + 2).readInt16LE(0, true);
  }

  public readUInt16LE(offset: number): number {
    return this.subBuffer(offset, offset + 2).readUInt16LE(0, true);
  }

  public readInt32LE(offset: number): number {
    return this.subBuffer(offset, offset + 4).readInt32LE(0, true);
  }

  public readUInt32LE(offset: number): number {
    return this.subBuffer(offset, offset + 4).readUInt32LE(0, true);
  }


  public readDoubleLE(offset: number): number {
    return this.subBuffer(offset, offset + 8).readDoubleLE(0, true);
  }

  public readFloatLE(offset: number): number {
    return this.subBuffer(offset, offset + 4).readFloatLE(0, true);
  }

  /** similar to slice but no guarantee that the
   * backing Buffer returned will be the same
   * as the original, since it may span blocks.
   * @param {number} start
   * @param {number} end
   * @returns {Buffer}
   */
  public subBuffer(start: number, end?: number): Buffer {
    const origStart = start;
    let block = this.getOffsetBlock(start);
    if (!end) {
      end = this.length;
    }
    const origEnd = end;
    const length = origEnd - origStart;
    start -= block.startOffset;
    end = start + length;
    if (end > block.buffer.length) {
      // can't solve with simple slice, have to splice buffers together
      const buffer = Buffer.alloc(length);
      let read = 0;
      do {
        read += block.buffer.copy(buffer, read, start, end);
        start = 0;
        end = length - read;
        block = this.getOffsetBlock(origStart + read);
      } while (read < length);
      return buffer;
    } else {
      // can solve with simple slice
      const ret = block.buffer.slice(start, end);
      return ret;
    }
  }

  public writeInt8(int8: number, offset: number): number {
    const block = this.getOffsetBlock(offset);
    const thisOffset = offset - block.startOffset;
    return block.buffer.writeInt8(int8, thisOffset);
  }

  public writeUInt8(uint8: number, offset: number): number {
    const block = this.getOffsetBlock(offset);
    const thisOffset = offset - block.startOffset;
    return block.buffer.writeUInt8(uint8, thisOffset);
  }

  public writeInt16LE(int16: number, offset: number): number {
    const buffer = Buffer.alloc(2);
    buffer.writeInt16LE(int16, 0, true);
    return this.writeBuffer(buffer, offset);
  }

  public writeUInt16LE(uint16: number, offset: number): number {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(uint16, 0, true);
    return this.writeBuffer(buffer, offset);
  }

  public writeInt32LE(int32: number, offset: number): number {
    const buffer = Buffer.alloc(4);
    buffer.writeInt32LE(int32, 0, true);
    return this.writeBuffer(buffer, offset);
  }

  public writeUInt32LE(uint32: number, offset: number): number {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(uint32, 0, true);
    return this.writeBuffer(buffer, offset);
  }

  public writeDoubleLE(float: number, offset: number): number {
    const buffer = Buffer.alloc(8);
    buffer.writeDoubleLE(float, 0, true);
    return this.writeBuffer(buffer, offset);
  }

  public writeFloatLE(float: number, offset: number): number {
    const buffer = Buffer.alloc(4);
    buffer.writeFloatLE(float, 0, true);
    return this.writeBuffer(buffer, offset);
  }

  public writeBuffer(buffer: Buffer, offset: number): number {
    let localOffset = offset;
    let wrote = 0;
    do {
      const block = this.getOffsetBlock(localOffset);
      localOffset = offset - block.startOffset + wrote;
      wrote += buffer.copy(block.buffer, localOffset, wrote);
    } while (wrote < buffer.length);
    if (this.length < offset + buffer.length) {
      this._length = offset + buffer.length;
    }
    return buffer.length;
  }

  private pushEmptyBlock() {
    this.blocks.push({
      buffer: Buffer.alloc(this.allocSize),
      compressed: false,
      startOffset: this.capacity,
      size: this.allocSize,
      lastUsed: new Date().getTime()
    });
    this._capacity += this.allocSize;
    this._uncompressedSize += this.allocSize;
    this._totalSize += this.allocSize;
    this.checkCache();
  }

  private decompressBlock(block: Block) {
    if (block.compressed) {
      this._totalSize -= block.buffer.length;
      this._compressedSize -= block.buffer.length;
      block.buffer = Buffer.from(this.decompress(block.buffer));
      block.compressed = false;
      block.lastUsed = new Date().getTime();
      this._uncompressedSize += block.buffer.length;
      this._totalSize += block.buffer.length;
    }
  }

  private getOffsetBlock(offset: number): Block {
    while (offset >= this.capacity) {
      this.pushEmptyBlock();
    }
    for (const block of this.blocks) {
      if (offset >= block.startOffset && offset < block.startOffset + block.size) {
        this.decompressBlock(block);
        this.checkCache();
        return block;
      }
    }
    // never hit, but ensures function type
    return this.blocks[this.blocks.length - 1];
  }
}
