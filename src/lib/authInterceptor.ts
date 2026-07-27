import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type PendingRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

let refreshPromise: Promise<string> | null = null;

const pendingQueue: PendingRequest[] = [];

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const isAuthEndpoint = (url?: string): boolean => {
  if (!url) return false;

  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/logout')
  );
};

const processQueue = (
  error: unknown,
  token: string | null = null,
): void => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });

  pendingQueue.length = 0;
};

const refreshAccessToken = async (): Promise<string> => {
  const response = await axios.post(
    `${API_URL}/auth/refresh`,
    {},
    {
      // The refresh token is stored in an httpOnly cookie.
      // It must therefore be sent automatically by the browser.
      withCredentials: true,
    },
  );

  const { accessToken } = response.data;

  if (!accessToken) {
    throw new Error('Token refresh response did not contain an access token');
  }

  return accessToken;
};

const redirectToLogin = (): void => {
  if (typeof window === 'undefined') return;

  const currentPath = `${window.location.pathname}${window.location.search}`;

  const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;

  window.location.assign(loginUrl);
};

export const setupAuthInterceptor = (
  axiosInstance: AxiosInstance,
  getAccessToken: () => string | null,
  setAccessToken: (token: string) => void,
  signOut: () => void,
): (() => void) => {
  const requestInterceptor = axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const accessToken = getAccessToken();

      if (accessToken && !isAuthEndpoint(config.url)) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      return config;
    },
  );

  const responseInterceptor = axiosInstance.interceptors.response.use(
    (response) => response,

    async (error: AxiosError) => {
      const originalRequest = error.config as
        | RetryableRequestConfig
        | undefined;

      if (!originalRequest) {
        return Promise.reject(error);
      }

      const isUnauthorized = error.response?.status === 401;

      if (
        !isUnauthorized ||
        originalRequest._retry ||
        isAuthEndpoint(originalRequest.url)
      ) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken()
          .then((newAccessToken) => {
            setAccessToken(newAccessToken);

            processQueue(null, newAccessToken);

            return newAccessToken;
          })
          .catch((refreshError) => {
            processQueue(refreshError);

            signOut();
            redirectToLogin();

            throw refreshError;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const newAccessToken = await new Promise<string>(
          (resolve, reject) => {
            pendingQueue.push({
              resolve,
              reject,
            });
          },
        );

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    },
  );

  return () => {
    axiosInstance.interceptors.request.eject(requestInterceptor);
    axiosInstance.interceptors.response.eject(responseInterceptor);
  };
};