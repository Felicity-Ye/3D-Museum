import assert from 'node:assert/strict'
import test from 'node:test'
import { canUseWebGL } from '../src/lib/webgl.js'

test('WebGL capability probing reuses its result and releases the probe context', () => {
  const originalDocument = globalThis.document
  let canvasCount = 0
  let contextCount = 0
  let releaseCount = 0

  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, 'canvas')
      canvasCount += 1
      return {
        getContext(type) {
          if (type !== 'webgl2') return null
          contextCount += 1
          return {
            getExtension(name) {
              assert.equal(name, 'WEBGL_lose_context')
              return { loseContext: () => { releaseCount += 1 } }
            },
          }
        },
      }
    },
  }

  try {
    assert.equal(canUseWebGL(), true)
    assert.equal(canUseWebGL(), true)
    assert.equal(canvasCount, 1)
    assert.equal(contextCount, 1)
    assert.equal(releaseCount, 1)
  } finally {
    globalThis.document = originalDocument
  }
})
