import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: "select_account"
});

// ログイン（ポップアップ方式）
// export async function loginWithGoogle() {
//   const result = await signInWithPopup(auth, provider);
//   return result.user;
// }
// ① Googleのページへ飛ばす
export async function loginWithGoogle() {
  await signInWithRedirect(auth, provider);
}

// ② 戻ってきたときに結果を受け取る
export async function handleRedirectResult() {
  const result = await getRedirectResult(auth);
  return result?.user || null;
}

export async function logout() {
  await signOut(auth);
}

export function watchAuthState(callback) {
  onAuthStateChanged(auth, callback);
}

export const storage = getStorage(app);