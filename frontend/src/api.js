// src/api.js — ALL API calls in one place
// Bug #8 fixed: explicit startup check for VITE_API_URL
import axios from 'axios';

const _rawBase = import.meta.env.VITE_API_URL;
if (!_rawBase) {
  console.warn(
    "[ClamkaBot] VITE_API_URL is not set.\n" +
    "  → For local dev: create frontend/.env.local with:\n" +
    "      VITE_API_URL=http://localhost:8000\n" +
    "  → For Vercel: add VITE_API_URL in Project → Settings → Environment Variables\n" +
    "  Falling back to http://localhost:8000"
  );
}
const BASE = _rawBase || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE });

// Attach JWT token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Global 401 handler — ONLY redirect on login/register endpoints
// For all other endpoints, let the component handle the error itself
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
      if (isAuthEndpoint) {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
      // For all non-auth endpoints (query, history, etc.), just reject — let the component show the error
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────
export const register = (name, email, password) =>
  api.post('/auth/register', { name, email, password }).then(r => r.data);
export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then(r => r.data);

// ── Artifacts list ────────────────────────────────────────
export const getArtifacts = () =>
  api.get('/artifacts').then(r => r.data);

// ── Auth ── refresh
export const refreshToken = () =>
  api.post('/auth/refresh').then(r => r.data);

// ── Dataset ────────────────────────────────────────────────
export const uploadDataset = (formData) =>
  api.post('/dataset/upload', formData).then(r => r.data);
export const previewDataset = (name) =>
  api.get(`/dataset/${name}/preview`).then(r => r.data);

// ── Query ─────────────────────────────────────────────────
export const generateQuery = (question, table_name) =>
  api.post('/query/generate', { question, table_name }).then(r => r.data);
export const runQuery = (history_id, table_name) =>
  api.post('/query/run', { history_id, table_name }).then(r => r.data);

// ── History + Search ───────────────────────────────────────
export const getHistory = (page = 1) =>
  api.get('/history', { params: { page } }).then(r => r.data);
export const searchHistory = (q) =>
  api.get('/history/search', { params: { q } }).then(r => r.data);

// ── Export ─────────────────────────────────────────────────
export const exportPDF = (id) =>
  api.get(`/history/${id}/export/pdf`, { responseType: 'blob' }).then(r => r.data);
export const exportDOCX = (id) =>
  api.get(`/history/${id}/export/docx`, { responseType: 'blob' }).then(r => r.data);

// ── Notifications ──────────────────────────────────────────
export const getNotificationCount = () =>
  api.get('/notifications/count').then(r => r.data);
export const clearNotifications = () =>
  api.post('/notifications/clear').then(r => r.data);

// ── TF-IDF suggest ────────────────────────────────────────
export const suggest = (q, table_name) =>
  api.get('/query/suggest', { params: { q, table_name } }).then(r => r.data);

// ── DB Explorer (for demo/jury) ───────────────────────────
export const getDbTables = () =>
  api.get('/db/tables').then(r => r.data);
export const getDbTableData = (tableName, page = 1) =>
  api.get(`/db/table/${tableName}`, { params: { page } }).then(r => r.data);
export const getDbSchema = () =>
  api.get('/db/schema').then(r => r.data);
