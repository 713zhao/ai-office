export const ZONES = [-28.65, -9.55, 9.55, 28.65]

// The furniture, people, camera and location marker share the same coordinates.
export function seatForIndex(floor, index) {
  const department = Math.floor(index / 50), local = index % 50
  const pod = Math.floor(local / 10), place = local % 10
  const side = place < 5 ? -1 : 1
  const podZ = -10.8 + pod * 6.3
  let x, z, angle, distance = 1.25
  if (floor === 2) {
    x = ZONES[department] + (place % 5 - 2) * 3.6 + side * .55
    z = podZ
    angle = side < 0 ? Math.PI / 2 : -Math.PI / 2
    distance = .85
  } else if (floor === 3) {
    const theta = place * Math.PI * 2 / 10
    x = ZONES[department] + Math.cos(theta) * 5
    z = podZ + Math.sin(theta) * 1.6
    angle = Math.atan2(-Math.cos(theta), -Math.sin(theta))
  } else {
    x = ZONES[department] + (place % 5 - 2) * 2.5
    z = podZ + side * .7
    angle = side < 0 ? 0 : Math.PI
  }
  const dx = Math.sin(angle), dz = Math.cos(angle)
  return { x, z, angle, dx, dz, chairX: x - dx * distance, chairZ: z - dz * distance }
}

export function agentPosition(floor, index, working) {
  if (working) {
    const seat = seatForIndex(floor, index)
    return { x: seat.chairX, z: seat.chairZ, angle: seat.angle }
  }
  const local = index % 50, col = local % 10, row = Math.floor(local / 10)
  return {
    x: ZONES[Math.floor(index / 50)] + (Math.floor(col / 2) - 2) * 3 + (col % 2 ? .5 : -.5) + ((index * 37) % 9 - 4) * .03,
    z: -23 + Math.floor(row / 2) * 3.1 + (row % 2) * 1.05 + ((index * 61) % 9 - 4) * .03,
    angle: ((index * 17) % 12) * Math.PI / 6,
  }
}

export function sharedLocations(floor) {
  return floor === 2
    ? { reception: [-51,-17], meeting: [-51,0], reports: [-51,17] }
    : floor === 3
      ? { reception: [51,17], meeting: [51,-5], reports: [51,-18] }
      : { reception: [-27,27.1], meeting: [0,27], reports: [27,27.1] }
}

export function focusArea(floor, focus, activeSet) {
  const [type, value] = focus.split('-')
  const index = Number(value)
  if (type === 'agent' && Number.isInteger(index) && index >= 0 && index < 200) {
    const { x, z } = agentPosition(floor, index, activeSet.has(index))
    return { x, z, width: 10, depth: 9, type, index }
  }
  if ((type === 'department' || type === 'idle') && index >= 0 && index < 4) {
    return { x: ZONES[index], z: type === 'idle' ? -19.5 : 3.3, width: 19, depth: type === 'idle' ? 11 : 37, type, index }
  }
  const shared = sharedLocations(floor)[focus]
  if (shared) return { x: shared[0], z: shared[1], width: 22, depth: 11, type: focus }
  return { x: floor === 2 ? -11.5 : floor === 3 ? 11.5 : 0, z: 4, width: floor === 1 ? 82 : 106, depth: 61, type: 'overview' }
}
