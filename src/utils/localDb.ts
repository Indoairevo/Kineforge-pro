import { VideoProject } from '../types/editor';

const IDB_NAME = 'kineforge_studio_db';
const IDB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_BLOBS = 'media_blobs';

function openLocalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProjectToIndexedDB(project: VideoProject): Promise<void> {
  try {
    const db = await openLocalDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).put(project);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback to localStorage snapshot if IDB is restricted
    try {
      localStorage.setItem(`kineforge_proj_${project.id}`, JSON.stringify(project));
      localStorage.setItem('kineforge_last_project_id', project.id);
    } catch {
      // Ignore quota errors
    }
  }
}

export async function loadProjectFromIndexedDB(projectId: string): Promise<VideoProject | null> {
  try {
    const db = await openLocalDb();
    return await new Promise<VideoProject | null>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).get(projectId);
      req.onsuccess = () => resolve((req.result as VideoProject) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(`kineforge_proj_${projectId}`);
      return raw ? (JSON.parse(raw) as VideoProject) : null;
    } catch {
      return null;
    }
  }
}

export async function saveMediaBlobToIndexedDB(assetId: string, blob: Blob): Promise<void> {
  try {
    const db = await openLocalDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readwrite');
      tx.objectStore(STORE_BLOBS).put(blob, assetId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore if unavailable
  }
}

export async function loadMediaBlobFromIndexedDB(assetId: string): Promise<Blob | null> {
  try {
    const db = await openLocalDb();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_BLOBS, 'readonly');
      const req = tx.objectStore(STORE_BLOBS).get(assetId);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  aspectRatio: string;
  clipCount: number;
  trackCount: number;
}

export async function fetchProjectsList(): Promise<{
  projects: ProjectSummary[];
  lastActiveProjectId: string;
}> {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('Failed to fetch projects list');
  return res.json();
}

export async function fetchProjectById(id: string): Promise<VideoProject> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Project not found on server');
  const data = await res.json();
  const project = data.project as VideoProject;

  // Rehydrate any locally stored binary media blobs from IndexedDB
  for (const asset of project.assets) {
    if (asset.blobUrl && asset.blobUrl.startsWith('blob:')) {
      const savedBlob = await loadMediaBlobFromIndexedDB(asset.id);
      if (savedBlob) {
        const freshUrl = URL.createObjectURL(savedBlob);
        asset.blobUrl = freshUrl;
        for (const clip of project.clips) {
          if (clip.assetId === asset.id) {
            clip.blobUrl = freshUrl;
          }
        }
      }
    }
  }
  return project;
}

export async function persistProjectEverywhere(project: VideoProject): Promise<string> {
  await saveProjectToIndexedDB(project);
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
  if (!res.ok) throw new Error('Failed to save project to database');
  const data = await res.json();
  return data.savedAt || new Date().toISOString();
}
