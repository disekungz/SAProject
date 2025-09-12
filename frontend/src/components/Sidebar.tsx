import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, Heart, Box, Smile, ChevronLeft,
  ClipboardList, DoorClosed, UserPen, Handshake, BookOpen,
  CalendarDays, BookOpenCheck, LogOut, ChevronRight, Contact
} from "lucide-react";
import "./Sidebar.css";
import { getUser, clearAuth } from "../lib/auth";
import { api } from "../lib/axios";

type Rank = { RankID: number; RankName: string };

const fallbackRankName = (id?: number) => {
  switch (id) {
    case 1: return "แอดมิน";
    case 2: return "ผู้คุม";
    case 3: return "ญาติ";
    default: return "—";
  }
};

export default function Sidebar() {
  const [user, setUser] = React.useState(() => getUser());
  const [collapsed, setCollapsed] = React.useState(false);
  const [ranks, setRanks] = React.useState<Rank[]>(() => {
    try {
      const cached = localStorage.getItem("ranksCache");
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });

  // sync user (login/logout/เปลี่ยนแท็บ)
  React.useEffect(() => {
    const sync = () => setUser(getUser());
    window.addEventListener("storage", sync);
    window.addEventListener("auth:changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth:changed", sync);
    };
  }, []);

  // โหลด rank + cache
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get("/ranks");
        if (!alive) return;
        const data: Rank[] = Array.isArray(res.data) ? res.data : [];
        setRanks(data);
        localStorage.setItem("ranksCache", JSON.stringify(data));
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const rankName =
    user
      ? (ranks.find(r => r.RankID === user?.rankId)?.RankName ?? fallbackRankName(user?.rankId))
      : null;

  // เมนู + สิทธิ์
  const menu = [
    { to: "/", icon: <LayoutDashboard size={18} />, label: "แดชบอร์ด", allowed: [1, 2] },
    { to: "/prisonermanagement", icon: <UserPen size={18} />, label: "จัดการข้อมูลผู้ต้องขัง", allowed: [1, 2] },
    { to: "/room_management", icon: <DoorClosed size={18} />, label: "จัดการห้องขัง", allowed: [1, 2] },
    { to: "/requestingmanagement", icon: <ClipboardList size={18} />, label: "เบิกของ / ขอใช้สิ่งของ", allowed: [1, 2] },
    { to: "/staffmanagement", icon: <Users size={18} />, label: "จัดการเจ้าหน้าที่", allowed: [1] },
    { to: "/medicalexamination", icon: <Heart size={18} />, label: "ตรวจรักษา / โรค", allowed: [1, 2] },
    { to: "/inventory", icon: <Box size={18} />, label: "คลังพัสดุและการจัดซื้อ", allowed: [1, 2] },
    { to: "/score-behavior", icon: <Smile size={18} />, label: "คะแนนความประพฤติ", allowed: [1, 2] },
    { to: "/visition", icon: <Handshake size={18} />, label: "เยี่ยมญาติ", allowed: [1, 2, 3] },
    { to: "/petition", icon: <BookOpen size={18} />, label: "ยื่นคำร้องทั่วไป", allowed: [1, 2] },
    { to: "/behavior", icon: <BookOpenCheck size={18} />, label: "การประเมินพฤติกรรม", allowed: [1, 2] },
    { to: "/activity", icon: <CalendarDays size={18} />, label: "ตารางกิจกรรมวิชาชีพ", allowed: [1, 2] },
    { to: "/membermanagement", icon: <Contact size={18} />, label: "จัดการสมาชิก", allowed: [1] },
  ];

  const visibleMenu = user ? menu.filter(m => m.allowed.includes(user.rankId)) : [];

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="brand">IPMS</div>
        {user && !collapsed && (
          <div className="user-box">
            <div className="user-name">👤 {user.firstName} {user.lastName}</div>
            <div className="user-rank">🏷️ {rankName}</div>
          </div>
        )}
      </div>

      <nav className="menu">
        {visibleMenu.map(m => (
          <NavLink
            key={m.to}
            to={m.to}
            className={({ isActive }) => `menu-item ${isActive ? "active" : ""}`}
            end={m.to === "/"}
            title={collapsed ? m.label : undefined}
          >
            {m.icon}
            {!collapsed && <span>{m.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="collapse-button" onClick={() => setCollapsed(v => !v)}>
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </div>

      <button
        type="button"
        className={`menu-item logout-btn ${collapsed ? "is-collapsed" : ""}`}
        onClick={() => {
          clearAuth();
          window.dispatchEvent(new Event("auth:changed"));
          window.location.href = "/login";
        }}
        title={collapsed ? "ออกจากระบบ" : undefined}
      >
        <LogOut size={18} />
        {!collapsed && <span>ออกจากระบบ</span>}
      </button>
    </aside>
  );
}
