import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../services/storage'

const MAX_BYTES = 10 * 1024 * 1024

export async function uploadMomentPhoto(
  uid: string,
  momentId: string,
  file: File,
): Promise<{ path: string; url: string }> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    throw new Error('Only JPEG or PNG images are allowed.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Each image must be under 10 MB.')
  }
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `users/${uid}/moments/${momentId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const photoRef = ref(storage, path)
  await uploadBytes(photoRef, file, { contentType: file.type })
  const url = await getDownloadURL(photoRef)
  return { path, url }
}

export async function deleteMomentPhotoByPath(photoPath: string): Promise<void> {
  await deleteObject(ref(storage, photoPath))
}
