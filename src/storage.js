import { storage } from "./firebase.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

export async function uploadPhoto(file, userId) {
  const fileName = `${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `pins/${fileName}`);

  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);

  return url;
}

export async function deletePhoto(imageUrl) {
  const photoRef = ref(storage, imageUrl);
  await deleteObject(photoRef);
}
