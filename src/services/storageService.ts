import { storage } from "@/lib/firebase/storage";
import { ref, uploadBytesResumable, getDownloadURL, type UploadTask } from "firebase/storage";

export async function uploadTicketImage(ticketId: string, file: File): Promise<string> {
  const filename = `${Date.now()}_${file.name}`;
  const storageRef = ref(storage(), `tickets/${ticketId}/images/${filename}`);
  
  return new Promise((resolve, reject) => {
    const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);
    
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`Upload is ${progress}% done`);
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
