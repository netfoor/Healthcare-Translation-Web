import '@testing-library/jest-dom'

// Mock Web Audio API
global.AudioContext = jest.fn(() => ({
  createMediaStreamSource: jest.fn(),
  createAnalyser: jest.fn(),
  createScriptProcessor: jest.fn(),
  close: jest.fn(),
  resume: jest.fn(),
  state: 'running',
  sampleRate: 44100
}))

global.webkitAudioContext = global.AudioContext

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ stop: jest.fn() }],
      getAudioTracks: () => [{ stop: jest.fn() }]
    })),
    enumerateDevices: jest.fn(() => Promise.resolve([]))
  },
  writable: true
})

// Mock navigator.permissions
Object.defineProperty(global.navigator, 'permissions', {
  value: {
    query: jest.fn(() => Promise.resolve({ state: 'granted' }))
  },
  writable: true
})

// Mock window.requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0))
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id))