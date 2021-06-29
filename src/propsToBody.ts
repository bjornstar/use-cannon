import {
  BODY_TYPES,
  Body,
  Box,
  ConvexPolyhedron,
  Cylinder,
  Heightfield,
  Material,
  Particle,
  Plane,
  Quaternion,
  Sphere,
  Trimesh,
  Vec3,
} from 'cannon-es'
import type {
  BodyProps,
  BodyType,
  CompoundShapeProps,
  PreparedArgs,
  PreparedBodyProps,
  ShapeType,
  Triplet,
} from './shared'
import type { Shape } from 'cannon-es'

const BodyTypeMap: Record<BodyType, typeof BODY_TYPES[keyof typeof BODY_TYPES]> = {
  Dynamic: BODY_TYPES.DYNAMIC,
  Static: BODY_TYPES.STATIC,
  Kinematic: BODY_TYPES.KINEMATIC,
}

declare module 'objects/Body' {
  interface Body {
    uuid: string
  }
}

const makeVec3 = ([x, y, z]: Triplet) => new Vec3(x, y, z)

const prepareBox = (args: PreparedArgs['Box']): ConstructorParameters<typeof Box> => [
  new Vec3(...args.map((v) => v / 2)),
]
const prepareConvexPolyhedron = ([
  v,
  faces,
  n,
  a,
  boundingSphereRadius,
]: PreparedArgs['ConvexPolyhedron']): ConstructorParameters<typeof ConvexPolyhedron> => [
  {
    vertices: v && v.map(makeVec3),
    faces,
    normals: n && n.map(makeVec3),
    axes: a && a.map(makeVec3),
    boundingSphereRadius,
  },
]
const prepareSphere = (args: number | [number]): ConstructorParameters<typeof Sphere> =>
  Array.isArray(args) ? args : [args]

const createShape: {
  [K in ShapeType | 'Compound']: (args: PreparedArgs[K]) => Shape
} = {
  Box: (args: PreparedArgs['Box']) => new Box(...prepareBox(args)),
  Compound: () => {
    throw new Error('Cannot create Compound shape')
  },
  ConvexPolyhedron: (args: PreparedArgs['ConvexPolyhedron']) =>
    new ConvexPolyhedron(...prepareConvexPolyhedron(args)),
  Cylinder: (args: PreparedArgs['Cylinder']) => new Cylinder(...args),
  Heightfield: (args: PreparedArgs['Heightfield']) => new Heightfield(...args),
  Particle: (args: PreparedArgs['Particle']) => new Particle(...args),
  Plane: (args: PreparedArgs['Plane']) => new Plane(...args),
  Sphere: (args: PreparedArgs['Sphere']) => new Sphere(...prepareSphere(args)),
  Trimesh: (args: PreparedArgs['Trimesh']) => new Trimesh(...args),
}

const createBody = (props: BodyProps) => {
  const {
    angularFactor = [1, 1, 1],
    angularVelocity = [0, 0, 0],
    collisionResponse,
    linearFactor = [1, 1, 1],
    mass,
    material,
    onCollide, // filtered out
    position = [0, 0, 0],
    rotation: quaternion = [0, 0, 0],
    type,
    velocity = [0, 0, 0],
    ...extra
  } = props

  const body = new Body({
    ...extra,
    mass: type === 'Static' ? 0 : mass,
    material: material && new Material(material),
    type: type && BodyTypeMap[type],
  })

  if (collisionResponse !== undefined) {
    body.collisionResponse = collisionResponse
  }

  body.angularFactor.set(...angularFactor)
  body.angularVelocity.set(...angularVelocity)
  body.linearFactor.set(...linearFactor)
  body.position.set(...position)
  body.quaternion.setFromEuler(...quaternion)
  body.velocity.set(...velocity)

  return body
}

function propsToBody<T extends ShapeType>(
  uuid: string,
  { args, shapes = [], ...props }: PreparedBodyProps<T>,
  shapeType: T | 'Compound',
) {
  const body = createBody(props)
  body.uuid = uuid

  if (shapeType === 'Compound') {
    shapes.forEach(addToBody(body))
  } else {
    // @ts-expect-error We cannot spread args here for some reason
    body.addShape(createShape[shapeType](...args))
  }

  return body
}

function addToBody(body: Body) {
  return ({ shapeType, args, position, rotation, material, ...extra }: CompoundShapeProps) => {
    const _offset = position && new Vec3(...position)
    const _orientation = rotation && new Quaternion().setFromEuler(...rotation)
    const shape = body.addShape(createShape[shapeType](args as any), _offset, _orientation)
    if (material) shape.material = new Material(material)
    Object.assign(shape, extra)
  }
}

export default propsToBody
