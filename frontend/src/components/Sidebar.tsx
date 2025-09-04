import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Heart,
  Box,
  Smile,
  ChevronLeft,
  ClipboardList,
  DoorClosed,
  UserPen,
  Handshake,
  BookOpen,
  CalendarDays,
  BookOpenCheck,
} from "lucide-react";
import "./Sidebar.css";

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">IPMS</div>
      <nav className="menu">
        <NavLink to="/" className="menu-item">
          <LayoutDashboard size={18} />
          <span>แดชบอร์ด</span>
        </NavLink>
        <NavLink to="/prisonermanagement" className="menu-item">
          <UserPen size={18} />
          <span>จัดการข้อมูลผู้ต้องขัง</span>
        </NavLink>
        <NavLink to="/room_management" className="menu-item">
          <DoorClosed size={18} />
          <span>จัดการห้องขัง</span>
        </NavLink>
        <NavLink to="/requestingmanagement" className="menu-item">
          <ClipboardList size={18} />
          <span>เบิกของ / ขอใช้สิ่งของ</span>
        </NavLink>
        <NavLink to="/staffmanagement" className="menu-item">
          <Users size={18} />
          <span>จัดการเจ้าหน้าที่</span>
        </NavLink>
        <NavLink to="/medicalexamination" className="menu-item">
          <Heart size={18} />
          <span>ตรวจรักษา / โรค</span>
        </NavLink>
        <NavLink to="/inventory" className="menu-item">
          <Box size={18} />
          <span>คลังพัสดุและการจัดซื้อ</span>
        </NavLink>
        <NavLink to="/Score Behavior" className="menu-item">
          <Smile size={18} />
          <span>คะแนนความประพฤติ</span>
        </NavLink>
        <NavLink to="/Visition" className="menu-item">
          <Handshake size={18} />
          <span>เยี่ยมญาติ</span>
        </NavLink>
        <NavLink to="/Petition" className="menu-item">
          <BookOpen size={18} />
          <span>ยื่นคำร้องทั่วไป</span>
        </NavLink>
        <NavLink to="/Behavior" className="menu-item">
          <BookOpenCheck size={18} />
          <span>การประเมินพฤติกรรม</span>
        </NavLink>
        <NavLink to="/Activity" className="menu-item">
          <CalendarDays size={18} />
          <span>ตารางกิจกรรมวิชาชีพ</span>
        </NavLink>
      </nav>
      <div className="collapse-button">
        <ChevronLeft size={20} />
      </div>
    </div>
  );
}
