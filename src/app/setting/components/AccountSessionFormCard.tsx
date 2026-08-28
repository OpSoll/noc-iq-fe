"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import usePasswordValidation from "@/hooks/usePasswordValidation";
import PasswordStrength from "@/components/auth/PasswordStrength";
import PasswordValidation from "@/components/auth/PasswordValidation";

type AuthUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
};

type AuthSessionResponse = {
  access_token: string;
  user: AuthUser;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

interface AccountSessionFormCardProps {
  currentUser: AuthUser | null;
  setCurrentUser: (user: AuthUser | null) => void;
  session: AuthSessionResponse | null;
  setSession: (session: AuthSessionResponse | null) => void;
  onUserSelected: (userId: string) => void;
}

export function AccountSessionFormCard({
  currentUser,
  setCurrentUser,
  session,
  setSession,
  onUserSelected,
}: AccountSessionFormCardProps) {
  const toast = useToast();
  const [registerForm, setRegisterForm] = useState({
    email: "operator@example.com",
    password: "secure123",
    full_name: "NOC Operator",
    role: "engineer",
  });
  const [loginForm, setLoginForm] = useState({
    email: "operator@example.com",
    password: "secure123",
  });

  const { password_strength, validation_result } = usePasswordValidation(
    registerForm.password,
  );
  const hasRegisterPasswordErrors = registerForm.password.length > 0 && !Object.values(validation_result).every(Boolean);

  async function handleRegister() {
    try {
      const response = await api.post<AuthUser>("/auth/register", registerForm);
      setCurrentUser(response.data);
      onUserSelected(response.data.id);
      toast("Account registered successfully.", "success");
    } catch (issue) {
      toast(getErrorMessage(issue), "error");
    }
  }

  async function handleLogin() {
    try {
      const response = await api.post<AuthSessionResponse>(
        "/auth/login",
        loginForm,
      );
      setSession(response.data);
      setCurrentUser(response.data.user);
      onUserSelected(response.data.user.id);
      toast("Signed in successfully.", "success");
    } catch (issue) {
      toast(getErrorMessage(issue), "error");
    }
  }

  async function handleLoadSession() {
    if (!session?.access_token) {
      toast("Login first to load the current session.", "error");
      return;
    }
    try {
      const response = await api.get<AuthUser>("/auth/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setCurrentUser(response.data);
      toast("Session refreshed from the backend.", "success");
    } catch (issue) {
      toast(getErrorMessage(issue), "error");
    }
  }

  async function handleLogout() {
    if (!session?.access_token) {
      setSession(null);
      setCurrentUser(null);
      toast("Local session cleared.", "info");
      return;
    }
    try {
      await api.post(
        "/auth/logout",
        {},
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      setSession(null);
      setCurrentUser(null);
      toast("Logged out successfully.", "success");
    } catch (issue) {
      toast(getErrorMessage(issue), "error");
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Account Session
        </h2>
        <p className="text-sm text-slate-500">
          Register, sign in, and validate the active backend session.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl bg-slate-50 p-4">
          <h3 className="font-medium text-slate-900">Register</h3>
          <input
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={registerForm.full_name}
            onChange={(event) =>
              setRegisterForm((current) => ({
                ...current,
                full_name: event.target.value,
              }))
            }
            placeholder="Full name"
          />
          <input
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={registerForm.email}
            onChange={(event) =>
              setRegisterForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="Email"
          />
          <input
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            type="password"
            value={registerForm.password}
            onChange={(event) =>
              setRegisterForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="Password"
            aria-invalid={hasRegisterPasswordErrors ? true : undefined}
            aria-describedby="password-strength-feedback-register"
          />
          <div
            id="password-strength-feedback-register"
            aria-live="polite"
            className="text-sm text-gray-500"
          >
            {registerForm.password.length > 0 && (
              <div className="mt-2 space-y-2">
                <PasswordStrength password_strength={password_strength} />
                <PasswordValidation validation_result={validation_result} />
              </div>
            )}
          </div>
          <button
            onClick={handleRegister}
            disabled={password_strength < 4}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Register account
          </button>
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-4">
          <h3 className="font-medium text-slate-900">Login</h3>
          <input
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={loginForm.email}
            onChange={(event) =>
              setLoginForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            placeholder="Email"
          />
          <input
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            type="password"
            value={loginForm.password}
            onChange={(event) =>
              setLoginForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="Password"
          />
          <button
            onClick={handleLogin}
            disabled={loginForm.password.length < 8}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sign in
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleLoadSession}
              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <h3 className="font-medium text-slate-900">Current user</h3>
        {currentUser ? (
          <dl className="mt-3 grid gap-2 text-slate-600">
            <div className="flex justify-between gap-4">
              <dt>User ID</dt>
              <dd className="font-medium text-slate-900">{currentUser.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Email</dt>
              <dd className="font-medium text-slate-900">
                {currentUser.email}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Role</dt>
              <dd className="font-medium text-slate-900">{currentUser.role}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-slate-500">No active user loaded yet.</p>
        )}
      </div>
    </section>
  );
}