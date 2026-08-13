import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';

let isSigningIn = false;
let cachedAccessToken = null;
let authInstance = null;

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');

export async function initAuth(onAuthSuccess, onAuthFailure) {
  try {
    const res = await fetch('./firebase-applet-config.json');
    const firebaseConfig = await res.json();
    const app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    
    return onAuthStateChanged(authInstance, async (user) => {
      if (user) {
        if (cachedAccessToken) {
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
        } else if (!isSigningIn) {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      } else {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    });
  } catch (e) {
    console.error('Failed to init auth', e);
  }
}

export async function googleSignIn() {
  if (!authInstance) throw new Error('Auth not initialized');
  try {
    isSigningIn = true;
    const result = await signInWithPopup(authInstance, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

export async function getAccessToken() {
  return cachedAccessToken;
}

export async function logout() {
  if (authInstance) {
    await signOut(authInstance);
  }
  cachedAccessToken = null;
}
