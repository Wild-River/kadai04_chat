import { storage } from "./firebase.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// ここで画像ファイルをStorageに保存する
export async function uploadPhoto(file, userId) {
  const fileName = `${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `pins/${fileName}`);

  const snapshot = await uploadBytes(storageRef, file); //ここでStorageにupload->snapshotに結果が入る
  const url = await getDownloadURL(snapshot.ref); //ここで表示用のURLを発行

  return url; // map.jsで呼ばれる
}

export async function deletePhoto(imageUrl) {
  const photoRef = ref(storage, imageUrl);
  await deleteObject(photoRef);
}
