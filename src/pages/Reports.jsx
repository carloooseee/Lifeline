import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import MapView from "../components/MapView";
import "../styles/report.css"; 

function History() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all");
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

  const filterAlerts = (alerts) => {
    if (filter === "all") return alerts;

    const now = new Date();
    return alerts.filter((alert) => {
      if (!alert.time) return false;

      const diff = now - alert.time;
      if (filter === "24h") return diff <= 24 * 60 * 60 * 1000;
      if (filter === "7d") return diff <= 7 * 24 * 60 * 60 * 1000;

      return true;
    });
  };

  return (
    <div className="area">
      <h1>Alert History</h1>
      <div className="filter">
        <button onClick={() => setFilter("all")}>All</button>
        <button onClick={() => setFilter("24h")}>Last 24 Hours</button>
        <button onClick={() => setFilter("7d")}>Last 7 Days</button>
      </div>

      {/* Alerts list*/}
      <div className="alertBox">
        {filterAlerts(alerts).length === 0 ? (
          <p>No alerts found</p>
        ) : (
          <ol>
            {filterAlerts(alerts).map((alert, index) => (
              <li key={alert.id}>
                <strong>{alert.message}</strong>
                <div className="details">
                  From: {alert.user} <br />
                  Location: {alert.coords.latitude}, {alert.coords.longitude} <br />
                  Time:{" "}
                  {alert.time
                    ? alert.time.toLocaleString()
                    : "No time provided"}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Show pins on map */}
      <MapView alerts={filterAlerts(alerts)} />

      <button className="viewButton" onClick={() => navigate("/home")}>
        Go back
      </button>
    </div>
  );
}

export default History;
