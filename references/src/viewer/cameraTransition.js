const TRANSITION_RATE = 4.2
const COMPLETION_DISTANCE_SQUARED = 0.0004

export function advanceCameraPose(position, target, destination, destinationTarget, delta, duration = 1) {
  const alpha = 1 - Math.exp(-(TRANSITION_RATE / Math.max(0.25, duration)) * Math.max(0, delta))
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

export function interpolateCameraPose(startPosition, startTarget, destination, destinationTarget, elapsed, duration) {
  const progress = Math.min(1, Math.max(0, elapsed / Math.max(0.05, duration)))
  const eased = progress * progress * (3 - 2 * progress)
  return {
    position: startPosition.clone().lerp(destination, eased),
    target: startTarget.clone().lerp(destinationTarget, eased),
    finished: progress >= 1,
  }
}
