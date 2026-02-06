import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { Agent } from "@shared/schema";
import { getToken, setToken, removeToken, getStoredAgent, setStoredAgent, removeStoredAgent } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  agent: Agent | null;
  authenticate: () => Promise<void>;
  logout: () => void;
  refreshAgent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);

  // Check for existing auth on mount
  useEffect(() => {
    const token = getToken();
    const storedAgent = getStoredAgent();
    if (token && storedAgent) {
      setIsAuthenticated(true);
      setAgent(storedAgent);
    }
  }, []);

  // Clear auth when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      removeToken();
      removeStoredAgent();
      setIsAuthenticated(false);
      setAgent(null);
    }
  }, [isConnected]);

  const refreshAgent = useCallback(async () => {
    if (!address) return;
    try {
      const response = await fetch(`/api/agents/by-address/${address}`);
      if (response.ok) {
        const data = await response.json();
        setAgent(data);
        setStoredAgent(data);
      }
    } catch (error) {
      console.error("Failed to refresh agent:", error);
    }
  }, [address]);

  const authenticate = useCallback(async () => {
    if (!address || !isConnected) {
      throw new Error("Wallet not connected");
    }

    setIsAuthenticating(true);
    try {
      // Get nonce
      const nonceRes = await apiRequest<{ nonce: string }>("POST", "/api/auth/nonce", { address });
      const { nonce } = nonceRes;

      // Sign message
      const message = `Sign this message to authenticate with Honeycomb.\n\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });

      // Verify signature and get JWT
      const verifyRes = await apiRequest<{ token: string; agent?: Agent }>("POST", "/api/auth/verify", {
        address,
        signature,
        nonce,
      });

      setToken(verifyRes.token);
      setIsAuthenticated(true);

      if (verifyRes.agent) {
        setAgent(verifyRes.agent);
        setStoredAgent(verifyRes.agent);
      }
    } catch (error) {
      console.error("Authentication failed:", error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, isConnected, signMessageAsync]);

  const logout = useCallback(() => {
    removeToken();
    removeStoredAgent();
    setIsAuthenticated(false);
    setAgent(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAuthenticating,
        agent,
        authenticate,
        logout,
        refreshAgent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
