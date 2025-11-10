import { BrowserRouter, Routes, Route } from "react-router-dom";
import Entry from "./pages/Entry.jsx";
import Home from "./pages/Home.jsx";
import Reports from "./pages/Reports.jsx";
import Signup from "./components/signup.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Entry />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

