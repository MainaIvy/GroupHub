export const API = {
  studentDashboard: '/api/accounts/dashboard/student/',
  notifications: '/api/accounts/notifications/',
  createGroup: '/api/accounts/groups/create/',
  joinGroup: '/api/accounts/groups/join/'
};

export function getStoredToken() {
  return localStorage.getItem('access_token');
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function pluralize(count, noun) {
  return `${count} ${noun}${Number(count) === 1 ? '' : 's'}`;
}

export function timeAgo(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function safeDate(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfDay(date) {
  const x = new Date(date);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function formatISODateOnly(d) {
  const dt = safeDate(d);
  if (!dt) return null;
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
