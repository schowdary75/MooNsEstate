export const constant = {
  baseUrl: (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_APP_BASE_URL || import.meta.env.VITE_BASE_URL)) ||
    (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BASE_URL) ||
    'http://127.0.0.1:5001/',
};

export default constant;
