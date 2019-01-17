# Bfr
[![Travis](https://api.travis-ci.com/freeeve/bfr.svg?branch=master)](https://travis-ci.com/freeeve/bfr)
[![Coveralls](https://img.shields.io/coveralls/freeeve/bfr.svg)](https://coveralls.io/github/freeeve/bfr)

Bfr is an attempt a wrapper for Buffer, except it
auto-extends, compresses, and has a concept of an LRU cache--
the amount of memory designated to stay uncompressed for use.

It is not meant to improve performance, but it is meant to save memory, 
for use when you can sacrifice a little performance for memory.

In testing, I found there is a balance between block size and 
how random your access is. Smaller block size decompresses faster,
so it ends up being faster for small random reads. Larger block size
has less overhead, so if you're just appending and reading large chunks,
it is a fair bit faster.

## Usage

```typescript
const bfr = new Bfr();
const data = Buffer.from('hello');
bfr.writeBuffer(data, 0);
console.log(bfr.subBuffer(0, 0 + data.length).toString()); // hello
console.log(bfr.length); // 5
// append a 32-bit int
bfr.writeUInt32LE(123123, bfr.length);
console.log(bfr.length); // 9
```

### Specifying allocation size and cache size
```typescript
// default is 4 and 64 for allocSizeKb and cacheSizeKb, respectively
// this bfr will have at most 4MB uncompressed blocks at once,
// feel free to write as much as you want...
const bfr = new Bfr({allocSizeKb:128, cacheSizeKb:1024 * 4});
for(let i = 0; i < 1000000; i++) {
  bfr.writeBuffer(Buffer.from('hello'.repeat(20)), bfr.length);
}
console.log(bfr.uncompressedSize); // 4194304
```

### Auto-extending
```typescript
// default is 4 and 64 for allocSizeKb and cacheSizeKb, respectively
// this bfr will have at most 4MB uncompressed blocks at once,
// feel free to write as much as you want...
// or start in the middle!
const bfr = new Bfr();
bfr.writeUInt32LE(123, 100000);
console.log(bfr.length); // 100004
console.log(bfr.uncompressedSize); // 65536 (64KB default cache size)
console.log(bfr.memoryUsage().compressed); // 633 (those 0 bytes compress well!)
```
