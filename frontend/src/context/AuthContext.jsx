import { createContext, useContext, useState, useEffect } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cbp_token");
    const storedUser = localStorage.getItem("cbp_user");
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await client.post("/login", { email, password });
    const { access_token, user_name, user_email } = res.data;
    localStorage.setItem("cbp_token", access_token);
    const userObj = { name: user_name, email: user_email };
    localStorage.setItem("cbp_user", JSON.stringify(userObj));
    setUser(userObj);
    return userObj;
  };

  const register = async (name, email, password) => {
    const res = await client.post("/register", { name, email, password });
    const { access_token, user_name, user_email } = res.data;
    localStorage.setItem("cbp_token", access_token);
    const userObj = { name: user_name, email: user_email };
    localStorage.setItem("cbp_user", JSON.stringify(userObj));
    setUser(userObj);
    return userObj;
  };

  const logout = () => {
    localStorage.removeItem("cbp_token");
    localStorage.removeItem("cbp_user");
    setUser(null);
  };

  const updateUser = (updates) => {
    const newUser = { ...user, ...updates };
    localStorage.setItem("cbp_user", JSON.stringify(newUser));
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
