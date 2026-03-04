import { initializeApp } from 'firebase/app'
import { type Analytics, getAnalytics } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyBP4B21NEeZpk9uTUJozdSNExgk4NX-O0o',
  authDomain: 'bte-alzheimers-fb.firebaseapp.com',
  projectId: 'bte-alzheimers-fb',
  storageBucket: 'bte-alzheimers-fb.firebasestorage.app',
  messagingSenderId: '604521649949',
  appId: '1:604521649949:web:c32d185e3bc241cff073f4',
  measurementId: 'G-16BHST8M14',
} as const

const app = initializeApp(firebaseConfig)

let analytics: Analytics | undefined
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app)
}

const auth = getAuth(app)

export { app, analytics, auth }

