import { HashRouter, Routes, Route } from "react-router-dom";
import Entry from "./pages/Entry.jsx";
import Home from "./pages/Home.jsx";
import Reports from "./pages/Reports.jsx";
import ResponderDashboard from "./pages/ResponderDashboard.jsx";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Entry />} />
        <Route path="/home" element={<Home />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/responder-dashboard" element={<ResponderDashboard />} />
        <Route path="/responder" element={<ResponderDashboard />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
