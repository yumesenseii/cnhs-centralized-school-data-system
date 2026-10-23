import { createRoot } from "react-dom/client";
import { useState } from "react";
import EcrRecordPage from "../../components/teacher/e-record/EcrRecordPage.jsx";
import { fixture } from "./ecr-fixture.mjs";
import { Toast } from "./ecr-browser-mocks.jsx";
function App() {
  const [version, remount] = useState(0);
  window.__ecrTest = { fixture, remount: () => remount((value) => value + 1) };
  return <><Toast /><EcrRecordPage key={version} classId="class-1" /></>;
}
createRoot(document.getElementById("root")).render(<App />);
