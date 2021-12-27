import {
  Body,
  Box,
  ConvexPolyhedron,
  Cylinder,
  Heightfield,
  Material,
  Particle,
  Plane,
  Quaternion,
  Shape,
  Sphere,
  Trimesh,
  Vec3,
} from 'cannon-es'
import type { BodyPropMap, BodyShapeType, ShapeType, Triplet, ConvexPolyhedronArgs, CylinderArgs, SerializableBodyPropMap } from './hooks'

const makeVec3 = ([x, y, z]: Triplet) => new Vec3(x, y, z)
const prepareConvexPolyhedron = ([v, faces, n, a, boundingSphereRadius]: ConvexPolyhedronArgs<Triplet>) => [
  {
    vertices: v ? v.map(makeVec3) : undefined,
    faces,
    normals: n ? n.map(makeVec3) : undefined,
    axes: a ? a.map(makeVec3) : undefined,
    boundingSphereRadius,
  },
]



const shapeMap: { [T in ShapeType]: (args: BodyPropMap[T]['args']) => Shape } = {
  Box: (args: Triplet) => new Box(new Vec3(...args.map((v) => v / 2))),
  ConvexPolyhedron: (args) => new ConvexPolyhedron(...prepareConvexPolyhedron(args)),
  Cylinder: (args: CylinderArgs) => new Cylinder(...args),

}
import type { SerializableArgsMap } from './hooks'
function createShape<T extends ShapeType>(props: SerializableArgsMap[T]) {
  switch (props.shapeName) {
    case 'Box':
      return new Box(new Vec3(...props.args.map((v: number) => v / 2))) // extents => halfExtents
    case 'ConvexPolyhedron':
      return new ConvexPolyhedron(...prepareConvexPolyhedron(props.args))
    case 'Cylinder':
      return new Cylinder(...props.args) // [ radiusTop, radiusBottom, height, numSegments ] = args
    case 'Heightfield':
      return new Heightfield(...props.args) // [ Array data, options: {minValue, maxValue, elementSize}  ] = args
    case 'Particle':
      return new Particle() // no args
    case 'Plane':
      return new Plane()
    case 'Sphere':
      return new Sphere(...props.args) // radius = args
    case 'Trimesh':
      return new Trimesh(...props.args) // [vertices, indices] = args
    default:
      throw new Error('invalid shape type')
  }
}

type PropsToBody<T extends BodyShapeType> = {
  props: SerializableBodyPropMap[T]
  shapeName: T
  uuid: string
}
type BodyPropsMap = {
  Box: PropsToBody<'Box'>
  Compound: PropsToBody<'Compound'>
  ConvexPolyhedron: PropsToBody<'ConvexPolyhedron'>
  Cylinder: PropsToBody<'Cylinder'>
  Heightfield: PropsToBody<'Heightfield'>
  Particle: PropsToBody<'Particle'>
  Plane: PropsToBody<'Plane'>
  Sphere: PropsToBody<'Sphere'>
  Trimesh: PropsToBody<'Trimesh'>
}

const propsToBody = <T extends BodyShapeType>(o: BodyPropsMap[T]): Body => {
  const {
    args = [],
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    velocity = [0, 0, 0],
    angularVelocity = [0, 0, 0],
    linearFactor = [1, 1, 1],
    angularFactor = [1, 1, 1],
    type: bodyType,
    mass,
    material,
    shapes,
    onCollide,
    collisionResponse,
    ...extra
  } = props

  const body = new Body({
    ...extra,
    mass: bodyType === 'Static' ? 0 : mass,
    type: bodyType ? Body[bodyType.toUpperCase()] : undefined,
    material: material ? new Material(material) : undefined,
  })
  body.uuid = uuid

  if (collisionResponse !== undefined) {
    body.collisionResponse = collisionResponse
  }

  if (o.shapeName === 'Compound') {
    shapes.forEach(({ type: shapeName, args, position, rotation, material, ...extra }) => {
      const shapeBody = body.addShape(
        createShape({ shapeName, args }),
        position ? new Vec3(...position) : undefined,
        rotation ? new Quaternion().setFromEuler(...rotation) : undefined,
      )
      if (material) shapeBody.material = new Material(material)
      Object.assign(shapeBody, extra)
    })
  } else {
    body.addShape(createShape({
      args: o.props.args,
      shapeName: o.shapeName
    }))
  }

  body.position.set(position[0], position[1], position[2])
  body.quaternion.setFromEuler(rotation[0], rotation[1], rotation[2])
  body.velocity.set(velocity[0], velocity[1], velocity[2])
  body.angularVelocity.set(angularVelocity[0], angularVelocity[1], angularVelocity[2])
  body.linearFactor.set(linearFactor[0], linearFactor[1], linearFactor[2])
  body.angularFactor.set(angularFactor[0], angularFactor[1], angularFactor[2])
  return body
}

export default propsToBody
