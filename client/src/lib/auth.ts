import type { Agent } from "@shared/schema";

const TOKEN_KEY = "honeycomb_jwt";
const AGENT_KEY = "honeycomb_agent";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredAgent(): Agent | null {
  const stored = localStorage.getItem(AGENT_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setStoredAgent(agent: Agent): void {
  localStorage.setItem(AGENT_KEY, JSON.stringify(agent));
}

export function removeStoredAgent(): void {
  localStorage.removeItem(AGENT_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function logout(): void {
  removeToken();
  removeStoredAgent();
}
