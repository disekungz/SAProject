// src/lib/auth.ts
export type AuthUser = {
  MID: number;
  username: string;
  firstName: string;
  lastName: string;
  rankId: number;
  citizenId: string;
};

const TOKEN_KEY = "access_token";
const USER_KEY  = "auth_user";

/** ย้าย token/user เก่าที่เคยเก็บใน localStorage -> sessionStorage ครั้งเดียว */
(function migrateOnce() {
  const t = localStorage.getItem(TOKEN_KEY);
  const u = localStorage.getItem(USER_KEY);
  if (t && u && !sessionStorage.getItem(TOKEN_KEY)) {
    sessionStorage.setItem(TOKEN_KEY, t);
    sessionStorage.setItem(USER_KEY, u);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
})();

/**
 * บันทึกข้อมูลล็อกอิน
 * - ค่า default: เก็บใน sessionStorage (ปิดเบราว์เซอร์แล้วหลุด)
 * - ถ้าติ๊ก Remember me ให้ส่ง { remember: true } จะเก็บใน localStorage
 */
export function saveAuth(token: string, user: AuthUser, opts?: { remember?: boolean }) {
  const store = opts?.remember ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
  // ล้างอีกที่ กันข้อมูลซ้ำ
  const other = store === localStorage ? sessionStorage : localStorage;
  other.removeItem(TOKEN_KEY);
  other.removeItem(USER_KEY);
  // แจ้ง component อื่น ๆ (เช่น Sidebar) ให้รีเฟรช state
  window.dispatchEvent(new Event("auth:changed"));
}

/** อ่าน token: เช็ค sessionStorage ก่อน แล้วค่อย fallback ไป localStorage (กรณี remember me) */
export function getToken(): string {
  return (
    sessionStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(TOKEN_KEY) ||
    ""
  );
}

/** อ่าน user: เช็ค sessionStorage ก่อน แล้วค่อย fallback ไป localStorage */
export function getUser(): AuthUser | null {
  const raw =
    sessionStorage.getItem(USER_KEY) ||
    localStorage.getItem(USER_KEY);
  try { return raw ? (JSON.parse(raw) as AuthUser) : null; } catch { return null; }
}

/** ล้างข้อมูลออกจากทั้งสองที่ */
export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("auth:changed"));
}
