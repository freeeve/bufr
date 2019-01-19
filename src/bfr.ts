import * as pako from 'pako';

export interface BfrOptions {
  allocSizeKb?: number;
  cacheSizeKb?: number;
}

interface Block {
  buffer: Buffer;
  compressed: boolean;
  startOffset: number;
  size: number;
  lastUsed: number;
}

export default class Bfr {
  public readonly allocSize: number = 1024 * 4;
  private _length: number = 0;
  private _capacity: number = 0;
  private _uncompressedSize = 0;
  public readonly cacheSize: number = 1024 * 64;
  private blocks: Block[] = [];

  public get length() {
    return this._length;
  }

  public get uncompressedSize() {
    return this._uncompressedSize;
  }

  public memoryUsage() {
    // TODO calculate metadata
    let total = 0;
    let uncompressed = 0;
    let compressed = 0;
    this.blocks.forEach(block => {
      total += block.buffer.length;
      if (block.compressed) {
        compressed += block.buffer.length;
      } else {
        uncompressed += block.buffer.length;
      }
    });
    return {total, uncompressed, compressed};
  }

  public get capacity() {
    return this._capacity;
  }

  constructor(options?: BfrOptions) {
    // console.log('new bfr', options);
    if (options) {
      if (options.allocSizeKb) {
        this.allocSize = options.allocSizeKb * 1024;
      }
      if (options.cacheSizeKb) {
        this.cacheSize = options.cacheSizeKb * 1024;
      }
    }
    this.pushEmptyBlock();
  }

  public toString(...options: any[]) {
    return this.toBuffer().toString(...options);
  }

  public toBuffer(): Buffer {
    return this.subBuffer(0);
  }

  public static from(something: any, ...options: any[]): Bfr {
    const bfr = new Bfr();
    bfr.writeBuffer(Buffer.from(something, ...options), 0);
    return bfr;
  }

  private compressBlock(block: Block) {
    block.compressed = true;
    const compressed = pako.deflateRaw(block.buffer);
    block.buffer = Buffer.from(compressed);
    this._uncompressedSize -= this.allocSize;

  }

  private checkCache(increase: number) {
    if (this.cacheSize < this.uncompressedSize + increase) {
      // console.log('out of cache: ', this.uncompressedSize + increase, this.cacheSize);
      let oldest = new Date().getTime();
      let oldestBlockIdx = 0;
      // TODO should really not scan through the whole list every time
      for (let idx = 0; idx < this.blocks.length; idx += 1) {
        const block = this.blocks[idx];
        if (!block.compressed && block.lastUsed < oldest) {
          oldest = block.lastUsed;
          oldestBlockIdx = idx;
        }
      }
      /*
      console.log(this.blocks.map(({compressed, lastUsed, startOffset}, idx) => {
        return {
          idx,
          compressed,
          lastUsed,
          startOffset
        };
      }));
      console.log('evicting block', oldestBlockIdx);
      */
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

  public readInt8(offset: number, noassert?: boolean): number {
    const buffer = this.subBuffer(offset, offset + 1);
    return buffer.readInt8(0, noassert);
  }

  public readUInt8(offset: number, noassert?: boolean): number {
    // probably not optimal
    // console.log(`reading uint8 at ${offset}`);
    const buffer = this.subBuffer(offset, offset + 1);
    return buffer.readUInt8(0, noassert);
  }

  public readInt16LE(offset: number, noassert?: boolean): number {
    // probably not optimal
    // console.log(`reading int16 at ${offset}`);
    const buffer = this.subBuffer(offset, offset + 2);
    return buffer.readInt16LE(0, noassert);
  }

  public readUInt16LE(offset: number, noassert?: boolean): number {
    // probably not optimal
    const buffer = this.subBuffer(offset, offset + 2);
    return buffer.readUInt16LE(0, noassert);
  }

  public readInt32LE(offset: number, noassert?: boolean): number {
    // probably not optimal
    // console.log(`reading int32 at ${offset}`);
    const buffer = this.subBuffer(offset, offset + 4);
    return buffer.readInt32LE(0, noassert);
  }

  public readUInt32LE(offset: number, noassert?: boolean): number {
    // probably not optimal
    const buffer = this.subBuffer(offset, offset + 4);
    return buffer.readUInt32LE(0, noassert);
  }


  public readDoubleLE(offset: number): number {
    // probably not optimal
    const buffer = this.subBuffer(offset, offset + 8);
    return buffer.readDoubleLE(0, true);
  }

  public readFloatLE(offset: number): number {
    // probably not optimal
    const buffer = this.subBuffer(offset, offset + 4);
    return buffer.readFloatLE(0, true);
  }

  /** similar to slice but no guarantee that the
   * backing Buffer returned will be the same
   * as the original, since it may span blocks.
   * @param {number} start
   * @param {number} end
   * @returns {Buffer}
   */
  public subBuffer(start: number, end?: number): Buffer {
    // console.log(`subBuffer top start: ${start}, end: ${end}`);
    const origStart = start;
    let block = this.getOffsetBlock(start, true);
    if (!end) {
      end = this.length;
    }
    const origEnd = end;
    const length = origEnd - origStart;
    start -= block.startOffset;
    end = start + length;
    // console.log(`subBuffer length: ${length}, start: ${start}, end: ${end}`);
    if (end > block.buffer.length) {
      // can't solve with simple slice, have to splice buffers together
      const buffer = Buffer.alloc(length);
      let read = 0;
      do {
        read += block.buffer.copy(buffer, read, start, end);
        // console.log('subBuffer in first case loop', buffer.toString(), block.startOffset, read, start, end);
        start = 0;
        end = length - read;
        block = this.getOffsetBlock(origStart + read, true);
      } while (read < length);
      return buffer;
    } else {
      // can solve with simple slice
      const ret = block.buffer.slice(start, end);
      return ret;
    }
  }

  public writeInt8(int8: number, offset: number, noassert?: boolean): number {
    const buffer = Buffer.alloc(1);
    buffer.writeInt8(int8, 0, noassert);
    return this.writeBuffer(buffer, offset);
  }

  public writeUInt8(uint8: number, offset: number, noassert?: boolean): number {
    // probably not optimal
    // console.log(`writing uint8 ${uint8} at ${offset}`);
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(uint8, 0, noassert);
    return this.writeBuffer(buffer, offset);
  }

  public writeInt16LE(uint16: number, offset: number, noassert?: boolean): number {
    // probably not optimal
    const buffer = Buffer.alloc(2);
    buffer.writeInt16LE(uint16, 0, noassert);
    return this.writeBuffer(buffer, offset);
  }

  public writeUInt16LE(uint16: number, offset: number, noassert?: boolean): number {
    // probably not optimal
    const buffer = Buffer.alloc(2);
    // console.log(`writing int16 ${uint16} at ${offset}`);
    buffer.writeUInt16LE(uint16, 0, noassert);
    return this.writeBuffer(buffer, offset);
  }

  public writeInt32LE(uint32: number, offset: number, noassert?: boolean): number {
    // probably not optimal
    // console.log(`writing int32 ${uint32} at ${offset}`);
    const buffer = Buffer.alloc(4);
    buffer.writeInt32LE(uint32, 0, noassert);
    return this.writeBuffer(buffer, offset);
  }

  public writeUInt32LE(uint32: number, offset: number, noassert?: boolean): number {
    // probably not optimal
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(uint32, 0, noassert);
    return this.writeBuffer(buffer, offset);
  }

  public writeDoubleLE(float: number, offset: number, noassert?: boolean): number {
    // probably not optimal
    const buffer = Buffer.alloc(8);
    buffer.writeDoubleLE(float, 0, noassert);
    return this.writeBuffer(buffer, offset);
  }

  public writeFloatLE(float: number, offset: number, noassert?: boolean): number {
    // probably not optimal
    const buffer = Buffer.alloc(4);
    buffer.writeFloatLE(float, 0, noassert);
    return this.writeBuffer(buffer, offset);
  }

  // TODO insert (interject values at an offset)

  public writeBuffer(buffer: Buffer, offset: number): number {
    // console.log('writeBuffer', offset);
    let localOffset = offset;
    let wrote = 0;
    do {
      // console.log('writeBuffer in loop', localOffset + wrote);
      const block = this.getOffsetBlock(localOffset, true);
      localOffset = offset - block.startOffset + wrote;
      wrote += buffer.copy(block.buffer, localOffset, wrote);
    } while (wrote < buffer.length);
    if (this.length < offset + buffer.length) {
      this._length = offset + buffer.length;
    }
    return buffer.length;
  }

  private pushEmptyBlock(): number {
    this.blocks.push({
      buffer: Buffer.alloc(this.allocSize),
      compressed: false,
      startOffset: this.capacity,
      size: this.allocSize,
      lastUsed: new Date().getTime()
    });
    this._capacity += this.allocSize;
    this._uncompressedSize += this.allocSize;
    this.checkCache(0);
    return this.blocks.length - 1;
  }

  private ensureSpace(size: number): Block {
    // console.log("ensureSpace", size);
    while (size >= this.capacity) {
      // console.log("ensureSpace loop", size, this.capacity);
      this.pushEmptyBlock();
    }
    return this.blocks[this.blocks.length - 1];
  }

  private getOffsetBlock(offset: number, decompress: boolean): Block {
    // console.log("get offset block", offset);
    this.ensureSpace(offset);
    for (const block of this.blocks) {
      if (offset >= block.startOffset && offset < block.startOffset + block.size) {
        if (decompress && block.compressed) {
          const decompressed = pako.inflateRaw(block.buffer);
          block.buffer = Buffer.from(decompressed);
          block.compressed = false;
          block.lastUsed = new Date().getTime();
          this._uncompressedSize += block.size;
        }
        this.checkCache(0);
        return block;
      }
    }
    // never hit, but ensures function type
    return this.ensureSpace(offset);
  }
}
