import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import UserService from "../service/userService";

export const AuthContext = createContext(null);
export const useAuthContext = () => useContext(AuthContext);

const LS_USER_KEY = "eden_user";
const LS_LOGOUT_LOCK = "eden_logout_lock"; // ป้องกัน cookie zombie login

// ฟังก์ชันดึง user จาก localStorage ตอนเริ่มต้น
function initUserFromStorage() {
  try {
    // ถ้าเคย logout แล้ว → ไม่ให้ auto login จาก cookie
    if (localStorage.getItem(LS_LOGOUT_LOCK) === "1") return null;

    const saved = localStorage.getItem(LS_USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    localStorage.removeItem(LS_USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  // ✅ ใช้ init function ทำให้ตอนรีหน้าเว็บ ยังมี user ตั้งแต่เฟรมแรก
  const [user, setUser] = useState(() => initUserFromStorage());
  const [loading, setLoading] = useState(true);

  const isLocked = () => localStorage.getItem(LS_LOGOUT_LOCK) === "1";

  // ------------ refresh profile จาก backend ------------
  const refreshProfile = useCallback(async () => {
    if (isLocked()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await UserService.getUserProfile();
      const me = res?.data?.user ?? res?.data ?? null;

      if (me) {
        setUser(me);
        localStorage.setItem(LS_USER_KEY, JSON.stringify(me));
      } else {
        setUser(null);
        localStorage.removeItem(LS_USER_KEY);
      }
    } catch {
      setUser(null);
      localStorage.removeItem(LS_USER_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  // ------------ initial load ------------
  useEffect(() => {
    if (isLocked()) {
      setUser(null);
      setLoading(false);
      return;
    }

    // ไม่ต้องอ่าน localStorage ตรงนี้แล้ว เพราะอ่านไปตอน init แล้ว
    // ตรงนี้เอาไว้ sync กับ backend อย่างเดียว
    refreshProfile();
  }, [refreshProfile]);

  // ------------ login ------------
  const login = useCallback(async (payload) => {
    await UserService.loginUser(payload);

    // login แล้ว → เอา lock ออก
    localStorage.removeItem(LS_LOGOUT_LOCK);

    const res = await UserService.getUserProfile();
    const me = res?.data?.user ?? res?.data ?? null;

    if (me) {
      setUser(me);
      localStorage.setItem(LS_USER_KEY, JSON.stringify(me));
    }

    return me;
  }, []);

  // ------------ logout ------------
  const logout = useCallback(async () => {
    try {
      await UserService.logoutUser();
    } catch (err) {
      console.warn("Logout failed (ignored):", err);
    }

    // set lock กัน cookie แอบ login เองตอนรีหน้า
    localStorage.setItem(LS_LOGOUT_LOCK, "1");
    localStorage.removeItem(LS_USER_KEY);
    setUser(null);

    // reload ทั้งระบบ
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
