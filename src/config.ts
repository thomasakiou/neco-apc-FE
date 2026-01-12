const PROD_URL = 'https://vmi2848672.contaboserver.net/apcic/api';
const DEFAULT_LOCAL_URL = 'http://localhost:8000/api';

// Check if we are forcibly in local mode via localStorage
const currentEnv = localStorage.getItem('api_env'); // 'remote' | 'local'
const localUrl = localStorage.getItem('api_local_url') || DEFAULT_LOCAL_URL;

export const API_BASE_URL = currentEnv === 'local'
    ? localUrl
    : (import.meta.env.PROD ? PROD_URL : '/api');

export const IS_LOCAL_MODE = currentEnv === 'local';
