import Bfr from '../src/bfr';

describe('Bfr', () => {
  it('should be able to specify allocSizeKb alone', () => {
    const bfr = new Bfr({allocSizeKb: 24});
    expect(bfr.capacity).toEqual(24 * 1024);
    expect(bfr.allocSize).toEqual(24 * 1024);
  });

  it('should be able to do toString', () => {
    const expected = Buffer.from('123456789'.repeat(10)).toString('base64');
    const actual = Bfr.from('123456789'.repeat(10)).toString('base64');
    expect(actual).toEqual(expected);
  });

  it('should be able to specify cacheSizeKb alone', () => {
    const bfr = new Bfr({cacheSizeKb: 2048});
    expect(bfr.cacheSize).toEqual(2048 * 1024);
  });

  it('should be able to specify allocSizeKb/cacheSizeKb', () => {
    const bfr = new Bfr({allocSizeKb: 1024, cacheSizeKb: 2048});
    expect(bfr.cacheSize).toEqual(2048 * 1024);
    expect(bfr.capacity).toEqual(1024 * 1024);
    expect(bfr.allocSize).toEqual(1024 * 1024);
  });

  it('should be able to write/read a buffer at the beginning', () => {
    const bfr = new Bfr();
    const data = Buffer.from('hello'.repeat(10));
    bfr.writeBuffer(data, 0);
    const actual = bfr.subBuffer(0, 0 + data.length);
    expect(actual).toEqual(data);
  });

  it('should be able to write/read ints at the beginning', () => {
    let bfr = new Bfr();
    let value = 37123123;
    bfr.writeUInt32LE(value, 0);
    let actual = bfr.readUInt32LE(0);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = 37123;
    bfr.writeUInt16LE(value, 0);
    actual = bfr.readUInt16LE(0);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = 241;
    bfr.writeUInt8(value, 0);
    actual = bfr.readUInt8(0);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = -972312;
    bfr.writeInt32LE(value, 0);
    actual = bfr.readInt32LE(0);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = -9723;
    bfr.writeInt16LE(value, 0);
    actual = bfr.readInt16LE(0);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = -97;
    bfr.writeInt8(value, 0);
    actual = bfr.readInt8(0);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = 97.123;
    bfr.writeFloatLE(value, 0);
    actual = bfr.readFloatLE(0);
    expect(actual).toBeCloseTo(value, 5);

    bfr = new Bfr();
    value = 97.123123;
    bfr.writeDoubleLE(value, 0);
    actual = bfr.readDoubleLE(0);
    expect(actual).toBeCloseTo(value, 5);
  });


  it('should be able to write/read ints at the edge', () => {
    let bfr = new Bfr();
    let offset = bfr.capacity - 1;
    let value = 37123123;
    bfr.writeUInt32LE(value, offset);
    let actual = bfr.readUInt32LE(offset);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = 37123;
    bfr.writeUInt16LE(value, offset);
    actual = bfr.readUInt32LE(offset);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = 241;
    bfr.writeUInt8(value, offset);
    actual = bfr.readUInt8(offset);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = -972312;
    bfr.writeInt32LE(value, offset);
    actual = bfr.readInt32LE(offset);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = -9723;
    bfr.writeInt16LE(value, offset);
    actual = bfr.readInt16LE(offset);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = -97;
    bfr.writeInt8(value, offset);
    actual = bfr.readInt8(offset);
    expect(actual).toEqual(value);

    bfr = new Bfr();
    value = 97.123;
    bfr.writeFloatLE(value, offset);
    actual = bfr.readFloatLE(offset);
    expect(actual).toBeCloseTo(value, 5);

    bfr = new Bfr();
    value = 97.123123;
    bfr.writeDoubleLE(value, offset);
    actual = bfr.readDoubleLE(offset);
    expect(actual).toBeCloseTo(value, 5);
  });

  it('should be able to write/read a buffer at the edge of allocSize', () => {
    const bfr = new Bfr({allocSizeKb: 32});
    const offset = 32 * 1024 - 23;
    const data = Buffer.from('there was a cat in the hat and he liked to be fat');
    bfr.writeBuffer(data, offset);
    const actual = bfr.subBuffer(offset, offset + data.length);
    expect(actual).toEqual(data);
  });

  it('should not let uncompressedSize exceed cacheSize (at least between operations)', () => {
    const bfr = new Bfr({allocSizeKb: 4, cacheSizeKb: 64});
    const wordCount = 10000;
    Array.from(Array(wordCount).keys()).forEach((x: number) => {
      const data = Buffer.from(('' + x).repeat(10));
      const offset = bfr.length;
      bfr.writeBuffer(data, offset);
      const actual = bfr.subBuffer(offset, offset + data.length);
      expect(actual).toEqual(data);
      expect(bfr.uncompressedSize).toBeLessThanOrEqual(bfr.cacheSize);
    });
    expect(bfr.length).toBeGreaterThan(bfr.cacheSize);
    expect(bfr.uncompressedSize).toBeLessThanOrEqual(bfr.cacheSize);
  })

  it('should be able to compress all', () => {
    const bfr = new Bfr({allocSizeKb: 4, cacheSizeKb: 128});
    const wordCount = 10000;
    Array.from(Array(wordCount).keys()).forEach((x: number) => {
      const data = Buffer.from(('' + x).repeat(10));
      const offset = bfr.length;
      bfr.writeBuffer(data, offset);
    });
    bfr.compressAll();
    expect(bfr.uncompressedSize).toEqual(0);
  })


  it('should be able to calculate memory usage', () => {
    const bfr = new Bfr({allocSizeKb: 4, cacheSizeKb: 128});
    const wordCount = 10240;
    const data = Buffer.from('0123456789');
    Array.from(Array(wordCount).keys()).forEach((x: number) => {
      const offset = bfr.length;
      bfr.writeBuffer(data, offset);
    });
    let memoryUsage = bfr.memoryUsage();
    // 4096 * 25 = 102400
    expect(memoryUsage.total).toEqual(102400);

    // write more data
    Array.from(Array(wordCount).keys()).forEach((x: number) => {
      const offset = bfr.length;
      bfr.writeBuffer(data, offset);
    });
    memoryUsage = bfr.memoryUsage();
    expect(memoryUsage.total).toBeGreaterThan(1024 * 128);
    expect(memoryUsage.total).toBeLessThan(1024 * 140);
    expect(memoryUsage.uncompressed).toBeLessThanOrEqual(1024 * 128);
    expect(memoryUsage.uncompressed).toBeGreaterThan(1024 * 120);
    expect(memoryUsage.compressed).toBeLessThanOrEqual(1024);
    expect(memoryUsage.compressed).toBeGreaterThan(128);
  });
});
