import { api, getRefreshToken, setTokens } from "@/lib/api";

export async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");
  const { data } = await api.post<{ access_token: string; refresh_token: string }>("/auth/refresh", {
    refresh_token: refreshToken,
  });
  setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}
