const TRANSITION_RATE = 4.2
const COMPLETION_DISTANCE_SQUARED = 0.0004

export function advanceCameraPose(position, target, destination, destinationTarget, delta) {
  const alpha = 1 - Math.exp(-TRANSITION_RATE * Math.max(0, delta))
  const nextPosition = position.clone().lerp(destination, alpha)
  const nextTarget = target.clone().lerp(destinationTarget, alpha)
  const finished = nextPosition.distanceToSquared(destination) < COMPLETION_DISTANCE_SQUARED
    && nextTarget.distanceToSquared(destinationTarget) < COMPLETION_DISTANCE_SQUARED

  if (finished) {
    nextPosition.copy(destination)
    nextTarget.copy(destinationTarget)
  }

  return { position: nextPosition, target: nextTarget, finished }
}
