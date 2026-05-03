import { initializeApp } from 'firebase/app'
import { type Analytics, getAnalytics } from 'firebase/analytics'

const env = import.meta.env

function requireEnv(name: string): string {
  const value = env[name as keyof typeof env] as string | undefined
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
  measurementId: requireEnv('VITE_FIREBASE_MEASUREMENT_ID'),
} as const

const app = initializeApp(firebaseConfig)

let analytics: Analytics | undefined
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app)
}

export { app, analytics }
