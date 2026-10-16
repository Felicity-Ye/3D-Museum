export function createTourState() {
  return {
    status: 'idle',
    phase: 'idle',
    chapterIndex: 0,
    elapsed: 0,
    requestId: 0,
  }
}

export function startTour(state, chapters) {
  if (!chapters.length) return state
  return {
    status: 'playing',
    phase: 'transition',
    chapterIndex: 0,
    elapsed: 0,
    requestId: state.requestId + 1,
  }
}

export function pauseTour(state) {
  return state.status === 'playing' ? { ...state, status: 'paused' } : state
}

export function resumeTour(state) {
  return state.status === 'paused' ? { ...state, status: 'playing' } : state
}

export function moveTourChapter(state, chapterIndex, chapters) {
  if (!chapters.length || state.status === 'idle') return state
  if (chapterIndex >= chapters.length) {
    return {
      ...state,
      status: state.status === 'completed' ? 'playing' : state.status,
      phase: 'final-transition',
      chapterIndex: chapters.length - 1,
      elapsed: 0,
      requestId: state.requestId + 1,
    }
  }
  const nextIndex = Math.max(0, chapterIndex)
  return {
    ...state,
    status: state.status === 'completed' ? 'playing' : state.status,
    phase: 'transition',
    chapterIndex: nextIndex,
    elapsed: 0,
    requestId: state.requestId + 1,
  }
}

export function advanceTour(state, delta, chapters) {
  if (state.status !== 'playing' || state.phase !== 'narration') return state
  const chapter = chapters[state.chapterIndex]
  if (!chapter) return state
  const elapsed = state.elapsed + Math.max(0, delta)
  if (elapsed < chapter.duration) return { ...state, elapsed }
  return moveTourChapter(state, state.chapterIndex + 1, chapters)
}

export function arriveAtTourCamera(state, requestId) {
  if (state.requestId !== requestId) return state
  if (state.status !== 'playing' || !['transition', 'final-transition'].includes(state.phase)) return state
  if (state.phase === 'final-transition') return { ...state, status: 'completed', phase: 'completed', elapsed: 0 }
  return { ...state, phase: 'narration', elapsed: 0 }
}

export function exitTour(state) {
  return { ...createTourState(), requestId: state.requestId + 1 }
}
