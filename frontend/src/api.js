// frontend/src/api.js
import axios from 'axios';

// [CORRECTION TRIKI.COV] : URL configurable via variable d'environnement
// (évite de devoir modifier le code si le backend tourne sur un autre port/domaine)
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;