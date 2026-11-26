/**
 * Offline-first File Vault (static hosting build):
 * Stores binary blobs (PDFs, photos, profile pictures) in IndexedDB on this device.
 * File metadata still syncs through Firestore; the binary itself stays on the device
 * that uploaded it.
 */

const DB_NAME = 'empireos_file_vault';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putBlobInIdb(fileId: string, blob: Blob): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal if IndexedDB unavailable
  }
}

async function getBlobFromIdb(fileId: string): Promise<Blob | null> {
  try {
    const db = await openVaultDb();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(fileId);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function deleteBlobFromIdb(fileId: string): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function saveFileToVault(
  fileId: string,
  file: Blob,
  name: string,
  mimeType: string
): Promise<void> {
  await putBlobInIdb(fileId, file);
  void name;
  void mimeType;
}

export async function loadFileObjectUrl(fileId: string): Promise<string | null> {
  if (!fileId) return null;
  const localBlob = await getBlobFromIdb(fileId);
  if (localBlob) {
    return URL.createObjectURL(localBlob);
  }

  return null;
}

export async function removeFileFromVault(fileId: string): Promise<void> {
  await deleteBlobFromIdb(fileId);
}

/**
 * Compresses an uploaded profile image into a crisp square JPEG blob (256x256).
 */
export async function compressAvatarImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  const minDim = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - minDim) / 2;
  const sy = (bitmap.height - minDim) / 2;
  ctx.drawImage(bitmap, sx, sy, minDim, minDim, 0, 0, size, size);

  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.88);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
