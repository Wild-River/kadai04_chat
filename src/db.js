import { db } from "./firebase.js";
import { collection, addDoc, deleteDoc, getDocs, doc, updateDoc } from "firebase/firestore";

// ピンを保存
export async function savePin(data) {
  const docRef = await addDoc(collection(db, "pins"), { //Firestoreのpins/にデータを書き込む
    ...data,
    createdAt: new Date(),
  });
  return docRef;
}

// ピンを全件取得
export async function loadPins() {
  const snapshot = await getDocs(collection(db, "pins"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 削除関数
export async function deletePin(pinId) {
  await deleteDoc(doc(db, "pins", pinId));
}

// 更新関数
export async function updatePin(pinId, data) {
  await updateDoc(doc(db, "pins", pinId), data);
}