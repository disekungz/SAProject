import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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

export default function App() {
  return (
    <Router>
      <div style={{ display: "flex" }}>
        <Sidebar />
        <div style={{ flex: 1, padding: "20px" }}>
          <Routes>
            <Route path="/" element={<div>แดชบอร์ด</div>} />

            <Route
              path="/prisonermanagement"
              element={<PrisonerManagement />}
            />

            <Route
              path="/requestingmanagement"
              element={<RequestingManagement />}
            />

            <Route path="/room_management" element={<RoomManagement />} />

            <Route path="/staffmanagement" element={<StaffManagement />} />
            <Route
              path="/medicalexamination"
              element={<MedicalExamination />}
            />

            <Route path="/inventory" element={<InventorySystem />} />

            <Route path="/score behavior" element={<ScoreBehavior />} />

            <Route path="/Visition" element={<Visition />} />
            <Route path="/Petition" element={<Petition />} />
            <Route path="/Behavior" element={<BehaviorEvaluation />} />
            <Route path="/Activity" element={<ActivityAndVocationalTrainingSchedule />} />

            {/* Add other routes here */}
          </Routes>
        </div>
      </div>
    </Router>
  );
}
