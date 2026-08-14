import axios from 'axios';
import { clearSessionStorage } from '../auth/clearSessionStorage';

const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: apiBaseUrl,
});

const NAVIGATION_CACHE_TTL_MS = 2 * 60 * 1000;
const MODULE_DATA_CACHE_TTL_MS = 15 * 1000;
const NAVIGATION_CACHE_PATHS = new Set([
  "/clientes",
  "/productos",
  "/bodegas",
  "/telas",
  "/tallas",
  "/colores",
  "/categorias",
  "/usuarios",
  "/config/notificaciones",
  "/ventas",
  "/produccion",
  "/postventa",
  "/dashboard/resumen",
  "/inventario/reporte",
  "/documentos",
  "/metas/mensuales/actual",
]);
const MODULE_DATA_CACHE_PATHS = new Set([
  "/ventas", "/produccion", "/postventa", "/dashboard/resumen",
  "/inventario/reporte", "/documentos", "/metas/mensuales/actual",
]);
const navigationResponseCache = new Map<string, { expiresAt: number; response: any }>();
const navigationRequestsInFlight = new Map<string, Promise<any>>();
let navigationCacheToken: string | null = null;

const clearNavigationCache = () => {
  navigationResponseCache.clear();
  navigationRequestsInFlight.clear();
};

const syncNavigationCacheSession = () => {
  const currentToken = localStorage.getItem("token");
  if (currentToken !== navigationCacheToken) {
    clearNavigationCache();
    navigationCacheToken = currentToken;
  }
};

const normalizeCachePath = (url: string) => {
  const withoutOrigin = url.replace(apiBaseUrl, "");
  const path = withoutOrigin.split("?")[0];
  return path.startsWith("/") ? path : `/${path}`;
};

const stableParamsKey = (params: unknown) => {
  if (!params || typeof params !== "object") return "";
  return JSON.stringify(Object.entries(params as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)));
};

const rawApiGet = api.get.bind(api);
api.get = ((url: string, config: any = {}) => {
  syncNavigationCacheSession();
  const path = normalizeCachePath(url);
  if (!NAVIGATION_CACHE_PATHS.has(path)) return rawApiGet(url, config);

  const cacheKey = `${path}:${stableParamsKey(config?.params)}`;
  const cacheTtl = MODULE_DATA_CACHE_PATHS.has(path) ? MODULE_DATA_CACHE_TTL_MS : NAVIGATION_CACHE_TTL_MS;
  const cached = navigationResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
  if (cached) navigationResponseCache.delete(cacheKey);
  if (config?.signal) {
    return rawApiGet(url, config).then((response) => {
      navigationResponseCache.set(cacheKey, { response, expiresAt: Date.now() + cacheTtl });
      return response;
    });
  }

  const pending = navigationRequestsInFlight.get(cacheKey);
  if (pending) return pending;

  const request = rawApiGet(url, config)
    .then((response) => {
      navigationResponseCache.set(cacheKey, { response, expiresAt: Date.now() + cacheTtl });
      return response;
    })
    .finally(() => navigationRequestsInFlight.delete(cacheKey));
  navigationRequestsInFlight.set(cacheKey, request);
  return request;
}) as typeof api.get;

// Interceptor para agregar el token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (`${response.config.method || "get"}`.toLowerCase() !== "get") clearNavigationCache();
    return response;
  },
  (error) => {
    if (error?.response?.status === 401 && window.location.pathname !== "/login") {
      clearNavigationCache();
      navigationCacheToken = null;
      clearSessionStorage();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);
