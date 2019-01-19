import {Bufr} from '../src/bufr';

describe('Bfr', () => {
  it('should be able to specify allocSizeKb alone', () => {
    const bufr = new Bufr({allocSizeKb: 24});
    expect(bufr.capacity).toEqual(24 * 1024);
    expect(bufr.allocSize).toEqual(24 * 1024);
  });

  it('should be able to do toString', () => {
    const expected = Buffer.from('123456789'.repeat(10)).toString('base64');
    const actual = Bufr.from('123456789'.repeat(10)).toString('base64');
    expect(actual).toEqual(expected);
  });

  it('should be able to specify compression alone', () => {
    const bufr = new Bufr({compression: 'snappy'});
    expect(bufr.compression).toEqual('snappy');
  });

  it('should be able to specify cacheSizeKb alone', () => {
    const bufr = new Bufr({cacheSizeKb: 2048});
    expect(bufr.cacheSize).toEqual(2048 * 1024);
  });

  it('should be able to specify allocSizeKb/cacheSizeKb', () => {
    const bufr = new Bufr({allocSizeKb: 1024, cacheSizeKb: 2048});
    expect(bufr.cacheSize).toEqual(2048 * 1024);
    expect(bufr.capacity).toEqual(1024 * 1024);
    expect(bufr.allocSize).toEqual(1024 * 1024);
  });

  it('should be able to write/read a buffer at the beginning', () => {
    const bufr = new Bufr();
    const data = Buffer.from('hello'.repeat(10));
    bufr.writeBuffer(data, 0);
    const actual = bufr.subBuffer(0, 0 + data.length);
    expect(actual).toEqual(data);
  });

  it('should be able to write/read ints at the beginning', () => {
    let bufr = new Bufr();
    let value = 37123123;
    bufr.writeUInt32LE(value, 0);
    let actual = bufr.readUInt32LE(0);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = 37123;
    bufr.writeUInt16LE(value, 0);
    actual = bufr.readUInt16LE(0);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = 241;
    bufr.writeUInt8(value, 0);
    actual = bufr.readUInt8(0);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = -972312;
    bufr.writeInt32LE(value, 0);
    actual = bufr.readInt32LE(0);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = -9723;
    bufr.writeInt16LE(value, 0);
    actual = bufr.readInt16LE(0);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = -97;
    bufr.writeInt8(value, 0);
    actual = bufr.readInt8(0);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = 97.123;
    bufr.writeFloatLE(value, 0);
    actual = bufr.readFloatLE(0);
    expect(actual).toBeCloseTo(value, 5);

    bufr = new Bufr();
    value = 97.123123;
    bufr.writeDoubleLE(value, 0);
    actual = bufr.readDoubleLE(0);
    expect(actual).toBeCloseTo(value, 5);
  });


  it('should be able to write/read ints at the edge', () => {
    let bufr = new Bufr();
    let offset = bufr.capacity - 1;
    let value = 37123123;
    bufr.writeUInt32LE(value, offset);
    let actual = bufr.readUInt32LE(offset);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = 37123;
    bufr.writeUInt16LE(value, offset);
    actual = bufr.readUInt32LE(offset);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = 241;
    bufr.writeUInt8(value, offset);
    actual = bufr.readUInt8(offset);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = -972312;
    bufr.writeInt32LE(value, offset);
    actual = bufr.readInt32LE(offset);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = -9723;
    bufr.writeInt16LE(value, offset);
    actual = bufr.readInt16LE(offset);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = -97;
    bufr.writeInt8(value, offset);
    actual = bufr.readInt8(offset);
    expect(actual).toEqual(value);

    bufr = new Bufr();
    value = 97.123;
    bufr.writeFloatLE(value, offset);
    actual = bufr.readFloatLE(offset);
    expect(actual).toBeCloseTo(value, 5);

    bufr = new Bufr();
    value = 97.123123;
    bufr.writeDoubleLE(value, offset);
    actual = bufr.readDoubleLE(offset);
    expect(actual).toBeCloseTo(value, 5);
  });

  it('should be able to write/read a buffer at the edge of allocSize', () => {
    const bufr = new Bufr({allocSizeKb: 32});
    const offset = 32 * 1024 - 23;
    const data = Buffer.from('there was a cat in the hat and he liked to be fat');
    bufr.writeBuffer(data, offset);
    const actual = bufr.subBuffer(offset, offset + data.length);
    expect(actual).toEqual(data);
  });

  it('should not let uncompressedSize exceed cacheSize (at least between operations)', () => {
    const bufr = new Bufr({allocSizeKb: 4, cacheSizeKb: 64});
    const wordCount = 10000;
    Array.from(Array(wordCount).keys()).forEach((x: number) => {
      const data = Buffer.from(('' + x).repeat(10));
      const offset = bufr.length;
      bufr.writeBuffer(data, offset);
      const actual = bufr.subBuffer(offset, offset + data.length);
      expect(actual).toEqual(data);
      expect(bufr.uncompressedSize).toBeLessThanOrEqual(bufr.cacheSize);
    });
    expect(bufr.length).toBeGreaterThan(bufr.cacheSize);
    expect(bufr.uncompressedSize).toBeLessThanOrEqual(bufr.cacheSize);
  });

  it('should be able to compress all', () => {
    const bufr = new Bufr({allocSizeKb: 4, cacheSizeKb: 128});
    const wordCount = 10000;
    Array.from(Array(wordCount).keys()).forEach((x: number) => {
      const data = Buffer.from(('' + x).repeat(10));
      const offset = bufr.length;
      bufr.writeBuffer(data, offset);
    });
    bufr.compressAll();
    expect(bufr.uncompressedSize).toEqual(0);
  })


  it('should be able to calculate memory usage', () => {
    const bufr = new Bufr({allocSizeKb: 4, cacheSizeKb: 128});
    const wordCount = 10240;
    const data = Buffer.from('0123456789');
    for(let i = 0; i < wordCount; i++) {
      const offset = bufr.length;
      bufr.writeBuffer(data, offset);
    }
    // 4096 * 25 = 102400
    expect(bufr.totalSize).toEqual(102400);

    // write more data
    for(let i = 0; i < wordCount; i++) {
      const offset = bufr.length;
      bufr.writeBuffer(data, offset);
    }
    expect(bufr.totalSize).toBeGreaterThan(1024 * 128);
    expect(bufr.totalSize).toBeLessThan(1024 * 140);
    expect(bufr.uncompressedSize).toBeLessThanOrEqual(1024 * 128);
    expect(bufr.uncompressedSize).toBeGreaterThan(1024 * 120);
    expect(bufr.compressedSize).toBeLessThanOrEqual(1024);
    expect(bufr.compressedSize).toBeGreaterThan(128);
  });

  it('should be able to compress with snappy', () => {
    const bufr = new Bufr({allocSizeKb: 4, cacheSizeKb: 128, compression: 'snappy'});
    const wordCount = 10240;
    const data = Buffer.from('0123456789');
    for(let i = 0; i < wordCount; i++) {
      const offset = bufr.length;
      bufr.writeBuffer(data, offset);
    }
    // 4096 * 25 = 102400
    expect(bufr.totalSize).toEqual(102400);

    // write more data
    Array.from(Array(wordCount).keys()).forEach((x: number) => {
      const offset = bufr.length;
      bufr.writeBuffer(data, offset);
    });
    expect(bufr.totalSize).toBeGreaterThan(1024 * 128);
    expect(bufr.totalSize).toBeLessThan(1024 * 140);
    expect(bufr.uncompressedSize).toBeLessThanOrEqual(1024 * 128);
    expect(bufr.uncompressedSize).toBeGreaterThan(1024 * 120);
    expect(bufr.compressedSize).toBeLessThanOrEqual(4096);
    expect(bufr.compressedSize).toBeGreaterThan(128);
  });
});
