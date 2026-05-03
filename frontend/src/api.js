/**
 * api.js — central place for the backend base URL.
 *
 * Local dev:  leave REACT_APP_API_URL unset → proxy via package.json handles it
 * Production: set REACT_APP_API_URL=https://your-coolify-backend.yourdomain.com
 *             in your Vercel project environment variables
 */
const API_BASE = process.env.REACT_APP_API_URL || '';
export default API_BASE;
