import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  doc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { app } from "../firebase";
import { prioritizeAlert } from "../utils/ml.js";
import "../styles/home.css";

const db = getFirestore(app);

function Home() {
  const [user, setUser] = useState(null);
  const [coords, setCoords] = useState(null);
  const [internetStatus, setInternetStatus] = useState(
    navigator.onLine ? "Online" : "Offline"
  );
  const [message, setMessage] = useState("");
  const [isFetchingLocation, setIsFetchingLocation] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const [activeAlert, setActiveAlert] = useState(null);

  const navigate = useNavigate();
  const auth = getAuth(app);

  const saveDataToStorage = (locationData) => {
    const dataToSave = {
      user: user
        ? user.isAnonymous
          ? `Guest (Temporary ID: ${user.uid})`
          : user.email
        : "Unknown User",
      coords: locationData.coords,
      message: message.trim() === "" ? "HELP" : message.trim(),
      time: new Date().toISOString(),
    };
    localStorage.setItem("lastLocation", JSON.stringify(dataToSave));
  };

  const fetchCurrentLocationForUI = () => {
    setIsFetchingLocation(true);
    if (!navigator.geolocation) {
      setCoords({ error: "Geolocation is not supported by your browser." });
      setIsFetchingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newCoords = { latitude, longitude };
        setCoords(newCoords);
        setIsFetchingLocation(false);
        saveDataToStorage({ coords: newCoords });
      },
      (err) => {
        console.error("UI Location Error:", err.message);
        setIsFetchingLocation(false);
      }
    );
  };

  const processPendingAlert = async (currentUser) => {
    const pendingAlert = localStorage.getItem("pendingAlert");
    if (pendingAlert && navigator.onLine) {
      try {
        const alertData = JSON.parse(pendingAlert);
        alertData.user = currentUser
          ? currentUser.isAnonymous
            ? `Guest (${currentUser.uid})`
            : currentUser.email
          : "Unknown User";

        await addDoc(collection(db, "Alerts"), alertData);
        localStorage.removeItem("pendingAlert");
        alert("Pending alert sent!");
      } catch (error) {
        console.error("Pending alert error:", error);
      }
    }
  };

  // LISTEN FOR ACTIVE ALERT
  useEffect(() => {
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      setActiveAlert(null);
      return;
    }

    const q = query(
      collection(db, "Alerts"),
      where("userId", "==", auth.currentUser.uid),
      where("alertCompleted", "==", false),
      orderBy("time", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveAlert({
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        });
      } else {
        setActiveAlert(null);
      }
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  // COMPLETE ALERT
  const markAlertCompleted = async () => {
    try {
      const current = getAuth().currentUser;
      if (!current) {
        alert("You must be signed in to complete the task.");
        return;
      }
      if (!activeAlert) return;

      if (!activeAlert.userId) {
        alert("This alert has no owner info.");
        return;
      }

      if (activeAlert.userId !== current.uid) {
        alert("You are not authorized to complete this alert.");
        return;
      }

      await deleteDoc(doc(db, "Alerts", activeAlert.id));
      alert("Task completed and removed.");
    } catch (err) {
      console.error("Complete task error:", err);
      alert("Failed to complete task.");
    }
  };

  // AUTH + STATUS
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && navigator.onLine) processPendingAlert(currentUser);
    });

    fetchCurrentLocationForUI();

    const handleOnline = () => {
      setInternetStatus("Online");
      if (user) processPendingAlert(user);
    };

    const handleOffline = () => setInternetStatus("Offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsub();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user]);

  const handleShareLocation = () => {
    fetchCurrentLocationForUI();
    alert("Updating location...");
  };

  const sendHelpRequest = async () => {
    // --- LOCAL RATE LIMIT: max 5 alerts per hour ---
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    let history = JSON.parse(localStorage.getItem("alertHistory")) || [];
    history = history.filter(t => now - t < oneHour);

    if (history.length >= 5) {
      alert("You are sending alerts too quickly. Please wait.");
      return;
    }

    history.push(now);
    localStorage.setItem("alertHistory", JSON.stringify(history));

    // --- 10 SECOND COOLDOWN ---
    const lastSend = localStorage.getItem("lastSendTimestamp");
    if (lastSend && now - Number(lastSend) < 10 * 1000) {
      const secondsLeft = Math.ceil((10 * 1000 - (now - Number(lastSend))) / 1000);
      alert(`Please wait ${secondsLeft} more second(s) before sending again.`);
      return;
    }
    localStorage.setItem("lastSendTimestamp", now.toString());
    // -----------------------------------------

    setIsSending(true);
    const finalMessage = message.trim() === "" ? "HELP" : message.trim();

    const sendAlert = async (locationData) => {
      let category = "Not Available";
      let urgency_level = "Not Available";

      try {
        const mlResults = await prioritizeAlert(finalMessage);
        category = mlResults.category;
        urgency_level = mlResults.urgency_level;
      } catch {}

      const alertData = {
        userId: auth.currentUser?.uid || null,
        user: user
          ? user.isAnonymous
            ? `Guest (${user.uid})`
            : user.email
          : "Unknown User",
        coords: locationData,
        message: finalMessage,
        time: new Date().toISOString(),
        category,
        urgency_level,
        alertCompleted: false,
      };

      try {
        await addDoc(collection(db, "Alerts"), alertData);
        alert("Help request sent!");
        setMessage("");
      } catch {
        localStorage.setItem("pendingAlert", JSON.stringify(alertData));
        alert("Offline, alert queued locally.");
      }

      setIsSending(false);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const data = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCoords(data);
        saveDataToStorage({ coords: data });
        sendAlert(data);
      },
      () => {
        sendAlert(coords || { error: "No location available" });
      }
    );
  };

  return (
    <div className="home-page-wrapper">
      <div className="logo home-logo">
        <h1>
          <span className="life">Life</span>
          <span className="line">Line</span>
        </h1>
        <p>Emergency Alert System</p>
      </div>

      <div className="Home">
        <div className="logo home-logo-mobile">
          <h1>
            <span className="life">Life</span>
            <span className="line">Line</span>
          </h1>
          <p>Emergency Alert System</p>
        </div>

        <div className="home-header">
          <h1>Welcome to Lifeline!</h1>

          {user ? (
            <p>
              Welcome{" "}
              {user.isAnonymous
                ? `Guest (Temporary ID: ${user.uid})`
                : user.email}
            </p>
          ) : (
            <p>Loading user...</p>
          )}

          <p>
            <span className="status-text">Status:</span>
            <span
              className={`status-indicator ${
                internetStatus === "Online"
                  ? "status-online"
                  : "status-offline"
              }`}
            >
              {internetStatus}
            </span>
          </p>
        </div>

        <div className="message-group">
          <label><b>Message:</b></label>
          <input
            className="message-input"
            type="text"
            placeholder="Enter your message (default: HELP)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <button className="btn btn-help" onClick={sendHelpRequest} disabled={isSending}>
          {isSending ? "Sending..." : "Send Help"}
        </button>

        <button
          className="btn btn-store"
          onClick={handleShareLocation}
          disabled={isFetchingLocation}
        >
          {isFetchingLocation ? "Getting Location..." : "Store Information"}
        </button>

        <div className="location-display">
          {isFetchingLocation && <p>Fetching current location...</p>}
          {!isFetchingLocation && coords && !coords.error && (
            <p>
              <b>Last known Coordinates</b><br />
              Latitude: {coords.latitude}, Longitude: {coords.longitude}
            </p>
          )}
          {!isFetchingLocation && coords?.error && (
            <p>Location Error: {coords.error}</p>
          )}
        </div>

        {!auth.currentUser?.isAnonymous && activeAlert && (
          <div className="active-alert">
            <h3>Active Alert</h3>
            <p><b>Message:</b> {activeAlert.message}</p>
            {activeAlert.coords && (
              <p>
                <b>Coords:</b> {activeAlert.coords.latitude},{" "}
                {activeAlert.coords.longitude}
              </p>
            )}
            <button className="btn btn-complete" onClick={markAlertCompleted}>
              ✓ Mark as Completed
            </button>
          </div>
        )}

        <button className="btn btn-map" onClick={() => navigate("/reports")}>
          View Alert
        </button>

        <a className="btn btn-logout" onClick={() => navigate("/")}>
          Log out
        </a>
      </div>
    </div>
  );
}

export default Home;
