import {Block} from './bufr'

export class CacheUtils {
  static findLruBlock(blocks: Block[]) {
    let oldest = new Date().getTime();
    let oldestBlockIdx = 0;
    // TODO should really not scan through the whole list every time
    for (let idx = 0; idx < blocks.length; idx += 1) {
      const block = blocks[idx];
      if (!block.compressed && block.lastUsed < oldest) {
        oldest = block.lastUsed;
        oldestBlockIdx = idx;
      }
    }
    return oldestBlockIdx;
  }
}
