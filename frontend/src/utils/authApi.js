import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Dedicated client for auth — no 401 redirect interceptor (avoids loops on login page)
const authApi = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function getAuthErrorMessage(error, fallback = 'Request failed') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => item?.msg).filter(Boolean);
    if (messages.length > 0) return messages.join(', ');
  }
  if (error?.message) return error.message;
  return fallback;
}

export default authApi;
