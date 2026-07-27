// GitHub Contents API storage for uploaded 3D models.
//
// Default persistence path for custom model uploads: files are committed to
// the project repo under public/models/ via the GitHub Contents API, so they
// survive browser data wipes and are served from raw.githubusercontent.com.
// IndexedDB remains the offline fallback (see App.tsx handleObjUpload).
//
// Configuration (see .env.example):
//   VITE_GITHUB_TOKEN  - fine-grained PAT with contents:write on the repo.
//                        NEVER hardcode a token in source.
//   VITE_GITHUB_BRANCH - target branch (defaults to 'main').

const OWNER = 'sudo-prog';
const REPO = '3ddd-studio';
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}/contents`;

const token: string | undefined = import.meta.env.VITE_GITHUB_TOKEN;
const branch: string = import.meta.env.VITE_GITHUB_BRANCH || 'main';

export const isGithubStorageConfigured = (): boolean => Boolean(token);

/** Convert a File/Blob to a base64 string (no data: prefix), chunk-safe for large files. */
const fileToBase64 = async (file: File | Blob): Promise<string> => {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

const sanitizeFilename = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_');

export interface GithubUploadResult {
  /** Permanent raw URL the model can be loaded from on any device. */
  rawUrl: string;
  /** Repo-relative path the file was committed to. */
  path: string;
}

/**
 * Upload a model file to the project repo via the GitHub Contents API.
 * Returns the raw.githubusercontent.com URL for the committed file.
 * Throws with a descriptive message on failure (missing token, API error).
 */
export const uploadModelToGithub = async (file: File): Promise<GithubUploadResult> => {
  if (!token) {
    throw new Error(
      'GitHub storage is not configured (VITE_GITHUB_TOKEN missing). ' +
      'Falling back to local browser storage.'
    );
  }

  const filename = sanitizeFilename(file.name);
  const path = `public/models/${filename}`;
  const content = await fileToBase64(file);

  // If the file already exists on the branch we must pass its sha to update it.
  let existingSha: string | undefined;
  const headRes = await fetch(`${API_BASE}/${path}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (headRes.ok) {
    const existing = await headRes.json();
    existingSha = existing?.sha;
  }

  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `chore(models): upload ${filename} via 3DDD Studio`,
      content,
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) detail += ` — ${body.message}`;
    } catch { /* ignore body parse errors */ }
    throw new Error(`GitHub upload failed: ${detail}`);
  }

  return {
    rawUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${branch}/${path}`,
    path,
  };
};
