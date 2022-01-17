import { EventEmitter } from 'events'

// @ts-expect-error Types are not setup for this yet
import Worker from '../src/worker'

import type { Triplet } from '../hooks'
import type {
  Broadphase,
  DefaultContactMaterial,
  IncomingWorkerMessage,
  Solver,
  CannonWorker,
  CannonWorkerApiProps,
} from '../setup'

export class CannonWorkerApi extends EventEmitter {
  private _buffers: {
    positions: Float32Array
    quaternions: Float32Array
  }
  private _gravity: Triplet

  public allowSleep: boolean
  public axisIndex: number
  public broadphase: Broadphase

  constructor({
    allowSleep = false,
    axisIndex = 0,
    broadphase = 'Naive' as const,
    defaultContactMaterial = { contactEquationStiffness: 1e6 },
    gravity = [0, -9.81, 0] as Triplet,
    iterations = 5,
    quatNormalizeFast = false,
    quatNormalizeSkip = 0,
    size = 1000,
    solver = 'GS' as const,
    stepSize = 1 / 60,
    tolerance = 0.001,
  }: CannonWorkerApiProps) {
    super()

    this._buffers = {
      positions: new Float32Array(size * 3),
      quaternions: new Float32Array(size * 4),
    }

    this.allowSleep = allowSleep
    this.axisIndex = axisIndex
    this.broadphase = broadphase
    this.defaultContactMaterial = defaultContactMaterial
    this._gravity = gravity
    this.iterations = iterations
    this.quatNormalizeFast = quatNormalizeFast
    this.quatNormalizeSkip = quatNormalizeSkip
    this.solver = solver
    this.tolerance = tolerance

    this.stepSize = stepSize
    this.worker = new Worker()

    this.worker.onmessage = (message: IncomingWorkerMessage) => {
      if (message.data.op === 'frame') {
        this._buffers.positions = message.data.positions
        this._buffers.quaternions = message.data.quaternions
      }
      this.emit(message.data.op, message.data)
    }
  }

  public defaultContactMaterial: DefaultContactMaterial

  set gravity(gravity: Triplet) {
    this._gravity = gravity
    this.worker.postMessage({ op: 'setGravity', props: gravity })
  }

  get gravity() {
    return this._gravity
  }

  init() {
    const {
      allowSleep,
      axisIndex,
      broadphase,
      defaultContactMaterial,
      gravity,
      iterations,
      quatNormalizeFast,
      quatNormalizeSkip,
      solver,
      tolerance,
    } = this

    this.worker.postMessage({
      op: 'init',
      props: {
        allowSleep,
        axisIndex,
        broadphase,
        defaultContactMaterial,
        gravity,
        iterations,
        quatNormalizeFast,
        quatNormalizeSkip,
        solver,
        tolerance,
      },
    })
  }

  public iterations: number
  public quatNormalizeFast: boolean
  public quatNormalizeSkip: number
  public solver: Solver

  step() {
    const {
      _buffers: { positions, quaternions },
      stepSize,
    } = this
    if (positions.byteLength || quaternions.byteLength) {
      console.log('step')
      this.worker.postMessage({ op: 'step', positions, props: { stepSize }, quaternions }, [
        positions.buffer,
        quaternions.buffer,
      ])
    } else {
      console.log(positions.byteLength, quaternions.byteLength)
    }
  }

  public stepSize: number

  terminate() {
    this.worker.terminate()
  }

  public tolerance: number
  public worker: CannonWorker
}
