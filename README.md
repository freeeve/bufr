# Bufr
[![Travis](https://api.travis-ci.com/freeeve/bufr.svg?branch=master)](https://travis-ci.com/freeeve/bufr)
[![Coveralls](https://img.shields.io/coveralls/freeeve/bufr.svg)](https://coveralls.io/github/freeeve/bufr)

Bufr is a wrapper for Buffer, adding features like
auto-extend, compression, and a concept of an LRU cache--the
amount of memory designated to stay uncompressed for use.

It is not meant to improve performance, but it is meant to save memory, 
for use when you can sacrifice a little performance for memory.

In testing, I found there is a balance between block size and 
how random your access is. Smaller block size decompresses faster,
so it ends up being faster for small random reads. Larger block size
has less overhead, so if you're just appending and reading large chunks,
it is a fair bit faster.

## Usage

```typescript
const bufr = new Bufr();
const data = Buffer.from('hello');
bufr.writeBuffer(data, 0);
console.log(bufr.subBuffer(0, 0 + data.length).toString()); // hello
console.log(bufr.length); // 5
// append a 32-bit int
bufr.writeUInt32LE(123123, bufr.length);
console.log(bufr.length); // 9
```

### Specifying allocation size and cache size
Cache size should be a multiple of allocation size, because it will
end up being one, anyway (rounded down). 

Cache size can be 0, but only in extreme cases. 
Every read/write will decompress/compress the block.

```typescript
// default is 4 and 64 for allocSizeKb and cacheSizeKb, respectively
// this bufr will have at most 4MB uncompressed blocks at once,
// feel free to write as much as you want...
const bufr = new Bufr({allocSizeKb:128, cacheSizeKb:1024 * 4});
for(let i = 0; i < 1000000; i++) {
  bufr.writeBuffer(Buffer.from('hello'.repeat(20)), bufr.length);
}
console.log(bufr.uncompressedSize); // 4194304
```

### Auto-extending
```typescript
// default is 4 and 64 for allocSizeKb and cacheSizeKb, respectively
// this bufr will have at most 4MB uncompressed blocks at once,
// feel free to write as much as you want...
// or start in the middle!
const bufr = new Bufr();
bufr.writeUInt32LE(123, 100000);
console.log(bufr.length); // 100004
console.log(bufr.uncompressedSize); // 65536 (64KB default cache size)
console.log(bufr.memoryUsage().compressed); // 633 (those 0 bytes compress well!)
```

## TODO 
* Read/write to file
* Offer an API for inserting data (extending in the middle of a buffer without overwriting)
* Improve LRU caching performance
* Decrease memory used by metadata (block management)
* Offer more compression algorithms, namely I think snappy would be a good addition (currently using pako `inflateRaw`/`deflateRaw`)
