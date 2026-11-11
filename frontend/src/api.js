import axios from 'axios';

const api = axios.create();
let refreshRequest = null;

export async function getAcademicCourses() {
  const { data } = await api.get('/api/accounts/academic/courses/');
  if (!Array.isArray(data?.courses)) {
    throw new Error('The courses response was invalid.');
  }
  return data.courses;
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) throw new Error('No refresh token is available.');

  if (!refreshRequest) {
    refreshRequest = axios.post('/api/accounts/jwt/refresh/', { refresh })
      .then(({ data }) => {
        if (!data?.access) throw new Error('Token refresh returned no access token.');
        localStorage.setItem('access_token', data.access);
        if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
        return data.access;
      })
      .finally(() => { refreshRequest = null; });
  }

  return refreshRequest;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(undefined, async (requestError) => {
  const originalRequest = requestError.config;
  if (requestError.response?.status !== 401 || !originalRequest || originalRequest._retry) {
    throw requestError;
  }

  originalRequest._retry = true;
  try {
    const token = await refreshAccessToken();
    originalRequest.headers.Authorization = `Bearer ${token}`;
    return await api.request(originalRequest);
  } catch (refreshError) {
    if ([400, 401].includes(refreshError.response?.status) || !localStorage.getItem('refresh_token')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.assign('/login');
    }
    throw refreshError;
  }
});

export default api;