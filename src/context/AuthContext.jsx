// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import UserService from "../service/userService"; // ชื่อไฟล์/ตัวพิมพ์ต้องตรงกับจริง ๆ

export const AuthContext = createContext(null);
export const useAuthContext = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await UserService.getUserProfile();
      // ✅ รองรับทั้ง { user: {...} } และ {...} ตรง ๆ
      const me = res?.data?.user ?? res?.data ?? null;
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const login = useCallback(async (payload) => {
    await UserService.loginUser(payload);   // เซ็ตคุกกี้เสร็จ
    const res = await UserService.getUserProfile();  // ดึงโปรไฟล์
    const me = res?.data?.user ?? res?.data ?? null;
    setUser(me);
    return me;  // ✅ คืน user ให้ผู้เรียก (StaffLoginPage ใช้ต่อได้)
  }, []);

  const logout = useCallback(async () => {
    try { await UserService.logoutUser(); } finally { setUser(null); }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
