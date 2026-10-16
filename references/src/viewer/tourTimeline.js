function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function subtitleAtTime(subtitles, time) {
  if (!Array.isArray(subtitles) || !Number.isFinite(time)) return null
  let low = 0
  let high = subtitles.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const subtitle = subtitles[mid]
    if (time < subtitle.start) high = mid - 1
    else if (time >= subtitle.end) low = mid + 1
    else return subtitle
  }
  return null
}

export function easeProgress(progress, easing = 'ease-in-out') {
  const t = clamp(progress, 0, 1)
  if (easing === 'linear') return t
  if (easing === 'ease-in') return t * t
  if (easing === 'ease-out') return 1 - (1 - t) * (1 - t)
  return t * t * (3 - 2 * t)
}

export function cameraPoseAtTime(keyframes, time, resolveKeyframe, anchorPose = null) {
  if (!Array.isArray(keyframes) || !keyframes.length || typeof resolveKeyframe !== 'function') return null
  const sorted = [...keyframes].sort((a, b) => a.time - b.time)
  if (anchorPose && time < sorted[0].time) {
    const targetPose = resolveKeyframe(sorted[0])
    if (!targetPose) return anchorPose
    const amount = easeProgress(time / Math.max(0.001, sorted[0].time), sorted[0].easing)
    return {
      position: anchorPose.position.clone().lerp(targetPose.position, amount),
      target: anchorPose.target.clone().lerp(targetPose.target, amount),
    }
  }
  const nextIndex = sorted.findIndex((frame) => frame.time > time)
  if (nextIndex === 0) return resolveKeyframe(sorted[0])
  if (nextIndex < 0) return resolveKeyframe(sorted.at(-1))

  const from = sorted[nextIndex - 1]
  const to = sorted[nextIndex]
  const fromPose = resolveKeyframe(from)
  const toPose = resolveKeyframe(to)
  if (!fromPose || !toPose) return fromPose || toPose || null
  const range = Math.max(0.001, to.time - from.time)
  const amount = easeProgress((time - from.time) / range, to.easing || from.easing)
  return {
    position: fromPose.position.clone().lerp(toPose.position, amount),
    target: fromPose.target.clone().lerp(toPose.target, amount),
  }
}
