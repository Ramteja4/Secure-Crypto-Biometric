/**
 * Axios client for biometric auth API.
 * Uses Vite proxy in dev: /register, /login -> backend :8000.
 */
import axios, { type AxiosError } from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? "",
  timeout: 120_000,
});

export type ApiEnvelope<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
};

export type LoginSuccessData = {
  access_token: string;
  token_type: string;
  match_score: number;
  threshold: number;
};

export type MismatchData = {
  match_score?: number;
  threshold?: number;
};

export async function registerUser(
  email: string,
  password: string,
  fingerprintFile: File
): Promise<ApiEnvelope> {
  const form = new FormData();
  form.append("email", email);
  form.append("password", password);
  form.append("fingerprint", fingerprintFile);

  const { data } = await api.post<ApiEnvelope>("/register", form);
  return data;
}

export async function loginUser(
  email: string,
  password: string,
  fingerprintFile: File
): Promise<ApiEnvelope<LoginSuccessData & MismatchData>> {
  const form = new FormData();
  form.append("email", email);
  form.append("password", password);
  form.append("fingerprint", fingerprintFile);

  const { data } = await api.post<ApiEnvelope<LoginSuccessData & MismatchData>>("/login", form);
  return data;
}

export function getErrorMessage(err: unknown): string {
  const ax = err as AxiosError<ApiEnvelope>;
  if (ax.response?.data && typeof ax.response.data === "object" && "message" in ax.response.data) {
    return String((ax.response.data as ApiEnvelope).message);
  }
  if (ax.message) return ax.message;
  return "Request failed";
}

export function getErrorData<T>(err: unknown): T | undefined {
  const ax = err as AxiosError<ApiEnvelope<T>>;
  return ax.response?.data?.data as T | undefined;
}
