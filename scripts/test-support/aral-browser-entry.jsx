import React from "react";
import { createRoot } from "react-dom/client";
import Teacher from "../../components/teacher/aral-program/TeacherAralMonitoringPage.jsx";
import Principal from "../../components/admin/monitoring/AdminAralMonitoringDashboard.jsx";

createRoot(document.getElementById("root")).render(<>
  {location.pathname === "/principal" ? <Principal /> : <Teacher />}
  <p id="test-toast" role="status" />
</>);
