import { 
  getAuth,
  type UserCredential, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut
} from 'firebase/auth'
import { app } from './firebaseConfig'

const auth = getAuth(app)

export function signUpWithEmailPassword(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password)
}

export function signInWithEmailPassword(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password)
}

export function signOutUser(): Promise<void> {
  return signOut(auth)
}

export { auth }
