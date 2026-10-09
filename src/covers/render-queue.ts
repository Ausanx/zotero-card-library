export type RenderTask<T> = () => Promise<T>;

type QueueEntry = {
  priority: number;
  task: RenderTask<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

export class RenderQueue {
  private readonly queue: QueueEntry[] = [];
  private active = 0;

  constructor(private readonly concurrency = 1) {}

  enqueue<T>(task: RenderTask<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        priority,
        task: task as RenderTask<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.queue.sort((left, right) => right.priority - left.priority);
      this.drain();
    });
  }

  clear(): void {
    for (const entry of this.queue.splice(0))
      entry.reject(new Error("Cover queue closed"));
  }

  private drain(): void {
    while (this.active < this.concurrency && this.queue.length) {
      const entry = this.queue.shift()!;
      this.active++;
      entry
        .task()
        .then((value) => entry.resolve(value))
        .catch((error) => entry.reject(error))
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }
}
