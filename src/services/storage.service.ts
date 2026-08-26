import { storage } from "@/lib/firebase/storage";
import { ref, uploadBytesResumable, getDownloadURL, type UploadTaskSnapshot } from "firebase/storage";

export type UploadProgress = {
  progress: number;
  snapshot: UploadTaskSnapshot;
};

export async function uploadFile(path: string, file: File, onProgress?: (progress: UploadProgress) => void): Promise<string> {
  const storageRef = ref(storage(), path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        onProgress?.({ progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100, snapshot });
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}

export function getStorageRef(path: string) {
  return ref(storage(), path);
}
