// src/components/Sidebar.tsx
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, Heart, Box, Smile, ChevronLeft,
  ClipboardList, DoorClosed, UserPen, Handshake, BookOpen,
  CalendarDays, BookOpenCheck,
} from "lucide-react";
import "./Sidebar.css";
import React from "react";
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
  const [ranks, setRanks] = React.useState<Rank[]>(
    () => {
      try {
        const cached = localStorage.getItem("ranksCache");
        return cached ? JSON.parse(cached) : [];
      } catch { return []; }
    }
  );

  React.useEffect(() => {
    const sync = () => setUser(getUser());
    window.addEventListener("storage", sync);
    window.addEventListener("auth:changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth:changed", sync);
    };
  }, []);

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
      ? (ranks.find(r => r.RankID === user.rankId)?.RankName ?? fallbackRankName(user.rankId))
      : null;

  // เมนู + สิทธิ์ที่อนุญาต (allowedRanks)
  const menu = [
    { to: "/", icon: <LayoutDashboard size={18} />, label: "แดชบอร์ด", allowed: [1, 2] },
    { to: "/prisonermanagement", icon: <UserPen size={18} />, label: "จัดการข้อมูลผู้ต้องขัง", allowed: [1, 2] },
    { to: "/room_management", icon: <DoorClosed size={18} />, label: "จัดการห้องขัง", allowed: [1, 2] },
    { to: "/requestingmanagement", icon: <ClipboardList size={18} />, label: "เบิกของ / ขอใช้สิ่งของ", allowed: [1, 2] },
    { to: "/staffmanagement", icon: <Users size={18} />, label: "จัดการเจ้าหน้าที่", allowed: [1, 2] },
    { to: "/medicalexamination", icon: <Heart size={18} />, label: "ตรวจรักษา / โรค", allowed: [1, 2] },
    { to: "/inventory", icon: <Box size={18} />, label: "คลังพัสดุและการจัดซื้อ", allowed: [1, 2] },
    { to: "/score-behavior", icon: <Smile size={18} />, label: "คะแนนความประพฤติ", allowed: [1, 2] },
    { to: "/visition", icon: <Handshake size={18} />, label: "เยี่ยมญาติ", allowed: [1, 2, 3] }, // ✅ ญาติเห็นได้
    { to: "/petition", icon: <BookOpen size={18} />, label: "ยื่นคำร้องทั่วไป", allowed: [1, 2] },
    { to: "/behavior", icon: <BookOpenCheck size={18} />, label: "การประเมินพฤติกรรม", allowed: [1, 2] },
    { to: "/activity", icon: <CalendarDays size={18} />, label: "ตารางกิจกรรมวิชาชีพ", allowed: [1, 2] },
    { to: "/membermanagement", icon: <Users size={18} />, label: "จัดการสมาชิก", allowed: [1] }, // admin only
  ];

  const visibleMenu = menu.filter(m =>
    !user ? false : m.allowed.includes(user.rankId)
  );

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        IPMS
        {user && (
          <div style={{ fontSize: 12, lineHeight: 1.25, marginTop: 4 }}>
            <div>👤 {user.firstName} {user.lastName}</div>
            <div style={{ opacity: 0.8 }}>🏷️ {rankName}</div>
          </div>
        )}
      </div>

      <nav className="menu">
        {visibleMenu.map(m => (
          <NavLink key={m.to} to={m.to} className="menu-item">
            {m.icon}
            <span>{m.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="collapse-button">
        <ChevronLeft size={20} />
      </div>

      <button
        onClick={() => {
          clearAuth();
          window.dispatchEvent(new Event("auth:changed"));
          window.location.href = "/login";
        }}
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
