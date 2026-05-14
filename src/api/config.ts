export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  useMocks: import.meta.env.VITE_USE_MOCKS !== 'false',
  headers: {
    'Content-Type': 'application/json',
  },
};
