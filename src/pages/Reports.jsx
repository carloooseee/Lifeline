import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase"; 
import "../styles/report.css";

function History() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all"); // all, 24h, 7d
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "Alerts"));
        const alertsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            message: data.message || "No message",
            user: data.user || "Unknown",
            coords: data.coords || {},
            time: data.time ? new Date(data.time) : null,
          };
        });
        setAlerts(alertsData);
      } catch (error) {
        console.error("Error fetching alerts:", error);
      }
    };

    fetchAlerts();
  }, []);

  // Apply filter
  const filteredAlerts = alerts.filter((alert) => {
    if (!alert.time) return false;

    const now = new Date();
    const diffMs = now - alert.time;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (filter === "24h") return diffHours <= 24;
    if (filter === "7d") return diffHours <= 24 * 7;
    return true; // "all"
  });

  return (
    <div className="area">
      <h1>Alert History</h1>

      {/* Filter Buttons */}
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setFilter("all")}>All</button>
        <button onClick={() => setFilter("24h")}>Last 24 Hours</button>
        <button onClick={() => setFilter("7d")}>Last 7 Days</button>
      </div>

      {filteredAlerts.length === 0 ? (
        <p>No alerts found</p>
      ) : (
        <ul>
          {filteredAlerts.map((alert) => (
            <li key={alert.id}>
              <strong>{alert.message}</strong> <br />
              From: {alert.user} <br />
              Location: {alert.coords.latitude}, {alert.coords.longitude} <br />
              Time:{" "}
              {alert.time
                ? alert.time.toLocaleString()
                : "No time provided"}
            </li>
          ))}
        </ul>
      )}

      <button className="viewButton" onClick={() => navigate("/home")}>
        Go back
      </button>
    </div>
  );
}

export default History;
