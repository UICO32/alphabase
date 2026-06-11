interface CommandManagerOptions {
  maxSize?: number
}

export class CommandManager {
  private _stack: { undo: () => void; redo: () => void }[] = []
  private _index = -1
  private _maxSize: number

  constructor(options?: CommandManagerOptions) {
    this._maxSize = options?.maxSize ?? 50
  }

  get canUndo(): boolean {
    return this._index >= 0
  }

  get canRedo(): boolean {
    return this._index < this._stack.length - 1
  }

  execute(undo: () => void, redo: () => void): void {
    redo()
    this._stack = this._stack.slice(0, this._index + 1)
    this._stack.push({ undo, redo })
    if (this._stack.length > this._maxSize) {
      this._stack.shift()
    }
    this._index = this._stack.length - 1
  }

  undo(): void {
    if (this._index < 0) return
    this._stack[this._index].undo()
    this._index--
  }

  redo(): void {
    if (this._index >= this._stack.length - 1) return
    this._index++
    this._stack[this._index].redo()
  }

  clear(): void {
    this._stack = []
    this._index = -1
  }
}
