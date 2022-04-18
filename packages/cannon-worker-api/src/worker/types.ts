import type { IncomingWorkerMessage } from '../types'

export interface CannonWorkerGlobalScope extends ServiceWorkerGlobalScope {
  postMessage(message: IncomingWorkerMessage['data'], transfer: Transferable[]): void
  postMessage(message: IncomingWorkerMessage['data'], options?: StructuredSerializeOptions): void
}
