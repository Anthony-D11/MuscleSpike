export default class RingBuffer {
  constructor(size) {
    this.size = size;
    this.data = new Array(size);
    this.ordered = new Array(size);
    this.pointer = 0;
    this.isFull = false;
  }

  push(item) {
    this.data[this.pointer] = item;
    this.pointer = (this.pointer + 1) % this.size;
    if (this.pointer === 0) this.isFull = true;
  }

  getOrdered() {
    if (!this.isFull) return this.data.slice(0, this.pointer);

    for (let i = 0; i < this.size; i++) {
      this.ordered[i] = this.data[(this.pointer + i) % this.size];
    }

    return this.ordered;
  }
}
