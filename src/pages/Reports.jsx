import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import "../styles/report.css";

function History() {
  const [alerts, setAlerts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        // ✅ Make sure collection name matches exactly: "Alerts"
        const querySnapshot = await getDocs(collection(db, "Alerts"));
        const alertsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();

          return {
            id: doc.id,
            message: data.message || "No message",
            user: data.user || "Unknown",
            coords: data.coords || {},
            // since `time` is a string, not Firestore Timestamp:
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

  return (
    <div className="area">
      <h1>Alert History</h1>
      {alerts.length === 0 ? (
        <p>No alerts found</p>
      ) : (
        <ul>
          {alerts.map((alert) => (
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
