import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const logAction = async (user: string, action: string) => {
  try {
    await addDoc(collection(db, 'logs'), {
      user,
      action,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Logging failed:", error);
  }
};
