import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import InventorySystem from "./components/InventorySystem";
import ScoreBehavior from "./components/ScoreBehavior";
import StaffManagement from "./components/StaffManagement";
import MedicalExamination from "./components/MedicalExamination";
import PrisonerManagement from "./components/PrisonerManagement";
import RequestingManagement from "./components/RequestingManagement";
import RoomManagement from "./components/RoomManagement";
import Visition from "./components/Visition";
import Petition from "./components/Petition";
import ActivityAndVocationalTrainingSchedule from "./components/ActivityAndVocationalTrainingSchedule";
import BehaviorEvaluation from "./components/BehaviorEvaluation";
import MemberManagement from "./components/MemberManagement";
import ProtectedRoute from "./components/protectedroute";
import RegisterPage from "./pages/register";
import LoginPage from "./pages/login";

function Shell() {
  const { pathname } = useLocation();
  const isAuth = pathname === "/login" || pathname === "/register";

  return (
    <div className="app-shell">
      {!isAuth && <Sidebar />}

      {/* ถ้าเป็นหน้า auth เอา padding ออกเพื่อให้เต็มขอบจริง ๆ */}
      <div style={{ flex: 1, padding: isAuth ? 0 : 20 }}>
        <Routes>
          {/* ไม่ต้องล็อกอิน */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ต้องล็อกอิน */}
          <Route path="/" element={<ProtectedRoute><div>แดชบอร์ด</div></ProtectedRoute>} />
          <Route path="/prisonermanagement" element={<ProtectedRoute><PrisonerManagement /></ProtectedRoute>} />
          <Route path="/requestingmanagement" element={<ProtectedRoute><RequestingManagement /></ProtectedRoute>} />
          <Route path="/room_management" element={<ProtectedRoute><RoomManagement /></ProtectedRoute>} />
          <Route path="/staffmanagement" element={<ProtectedRoute><StaffManagement /></ProtectedRoute>} />
          <Route path="/medicalexamination" element={<ProtectedRoute><MedicalExamination /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><InventorySystem /></ProtectedRoute>} />
          <Route path="/score-behavior" element={<ProtectedRoute><ScoreBehavior /></ProtectedRoute>} />
          <Route path="/visition" element={<ProtectedRoute><Visition /></ProtectedRoute>} />
          <Route path="/petition" element={<ProtectedRoute><Petition /></ProtectedRoute>} />
          <Route path="/behavior" element={<ProtectedRoute><BehaviorEvaluation /></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><ActivityAndVocationalTrainingSchedule /></ProtectedRoute>} />
          <Route path="/membermanagement" element={<ProtectedRoute><MemberManagement /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Shell />
    </Router>
  );
}
