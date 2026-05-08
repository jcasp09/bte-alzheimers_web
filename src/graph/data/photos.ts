import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../../firebase/storage'
import { GRAPH_IDS, type GraphId } from '../model/types'
import { nodePhotoStoragePath } from './_paths'

/** MIME types accepted by the person-node photo input. */
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png'] as const
/** Comma-joined value suitable for an `<input type="file" accept>` attribute. */
export const PHOTO_ACCEPT_ATTR = PHOTO_MIME_TYPES.join(',')
/** Human-readable label used in error copy. */
export const PHOTO_TYPE_LABEL = 'JPEG/PNG'

export function isAllowedPhotoType(file: File): boolean {
  return (PHOTO_MIME_TYPES as readonly string[]).includes(file.type)
}

export type UploadNodePhotoResult = {
  photoPath: string
  photoUrl: string
  photoUpdatedAt: string
}

export async function uploadPersonNodePhoto(
  uid: string,
  nodeId: string,
  file: File,
  graphId: GraphId = GRAPH_IDS.context,
): Promise<UploadNodePhotoResult> {
  const path = nodePhotoStoragePath(uid, graphId, nodeId)
  const photoRef = ref(storage, path)
  await uploadBytes(photoRef, file, { contentType: file.type })
  const photoUrl = await getDownloadURL(photoRef)
  return {
    photoPath: path,
    photoUrl,
    photoUpdatedAt: new Date().toISOString(),
  }
}

export async function deletePersonNodePhotoByPath(photoPath: string): Promise<void> {
  const photoRef = ref(storage, photoPath)
  await deleteObject(photoRef)
}
