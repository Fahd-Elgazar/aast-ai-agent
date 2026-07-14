// Single source of truth for the API base URL. Previously each service file
// declared its own fallback independently and they had drifted (some pointed
// at :8000, others at :8004), so a missing VITE_API_BASE silently sent
// different features to different, wrong ports.
export const API_BASE: string = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8004/api";
