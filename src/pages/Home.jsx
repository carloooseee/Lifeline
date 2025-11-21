import React, { useEffect, useState, useCallback } from "react";
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
  doc,
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

  // 🟢 ADDED: Track the currently active alert
  const [activeAlert, setActiveAlert] = useState(null);

  const navigate = useNavigate();
  const auth = getAuth(app);

  // -------------------------
  // YOUR EXISTING FUNCTIONS
  // (not modified)
  // -------------------------

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
            ? `Guest (Temporary ID: ${currentUser.uid})`
            : currentUser.email
          : "Unknown User";

        await addDoc(collection(db, "Alerts"), alertData);
        localStorage.removeItem("pendingAlert");
        alert("Pending help request successfully sent!");
      } catch (error) {
        console.error("Error sending pending alert:", error);
      }
    }
  };

  // ----------------------------------
  // 🟢 NEW: Real-time listener for active alert
  // ----------------------------------
  useEffect(() => {
    if (!user || !auth.currentUser) return;

    // Ignore guests — they can send alerts but cannot track/complete them
    if (auth.currentUser.isAnonymous) {
      setActiveAlert(null);
      return;
    }

    const alertsRef = collection(db, "Alerts");
    const q = query(
      alertsRef,
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
  }, [user]);

  // ----------------------------------
  // 🟢 NEW: Complete alert (delete document)
  // ----------------------------------
  const markAlertCompleted = async () => {
    if (!activeAlert) return;

    try {
      await deleteDoc(doc(db, "Alerts", activeAlert.id));
      alert("Task completed and removed.");
    } catch (err) {
      console.error("Error completing alert:", err);
    }
  };

  // -------------------------------
  // Auth + Online/Offline Listener
  // -------------------------------
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && navigator.onLine) {
        processPendingAlert(currentUser);
      }
    });

    fetchCurrentLocationForUI();

    const handleOnline = () => {
      setInternetStatus("Online");
      if (user) processPendingAlert(user);
    };

    const handleOffline = () => {
      setInternetStatus("Offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribeAuth();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user]);

  // -------------------------
  // sendHelpRequest MODIFIED:
  // Added alertCompleted + userId
  // -------------------------
  const sendHelpRequest = async () => {
    setIsSending(true);
    const finalMessage = message.trim() === "" ? "HELP" : message.trim();

    const sendAlert = async (locationData, isFresh = true) => {
      let category = "Not Available";
      let urgency_level = "Not Available";

      try {
        const mlResults = await prioritizeAlert(finalMessage);
        category = mlResults.category || "Not Available";
        urgency_level = mlResults.urgency_level || "Not Available";
      } catch (err) {
        console.warn("ML error, fallback values used.", err);
      }

      const alertData = {
        userId: user?.uid || null, // 🟢 NEW
        user: user
          ? user.isAnonymous
            ? `Guest (Temporary ID: ${user.uid})`
            : user.email
          : "Unknown User",
        coords: locationData,
        message: finalMessage,
        time: new Date().toISOString(),
        category,
        urgency_level,
        alertCompleted: false, // 🟢 NEW
      };

      if (navigator.onLine) {
        try {
          await addDoc(collection(db, "Alerts"), alertData);
          alert("Help request sent!");
          setMessage("");
        } catch (err) {
          localStorage.setItem("pendingAlert", JSON.stringify(alertData));
          alert("Offline, alert queued locally.");
        }
      } else {
        localStorage.setItem("pendingAlert", JSON.stringify(alertData));
        alert("Offline, alert queued locally.");
      }

      setIsSending(false);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const freshCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCoords(freshCoords);
        saveDataToStorage({ coords: freshCoords });
        sendAlert(freshCoords, true);
      },
      () => {
        const fallback = coords || { error: "No location available." };
        sendAlert(fallback, false);
      }
    );
  };

  return (
    <div className="home-page-wrapper">
      <div className="Home">
        {/* your existing UI ... */}

        {/* -------------------------------------- */}
        {/* 🟢 NEW: Active Alert Section */}
        {/* -------------------------------------- */}
        {!auth.currentUser?.isAnonymous && activeAlert && (
          <div className="active-alert-box">
            <h3>Active Alert</h3>
            <p><b>Message:</b> {activeAlert.message}</p>
            {activeAlert.coords && (
              <p>
                <b>Location:</b> {activeAlert.coords.latitude},{" "}
                {activeAlert.coords.longitude}
              </p>
            )}
            <button
              className="btn btn-complete"
              onClick={markAlertCompleted}
            >
              ✓ Mark as Completed
            </button>
          </div>
        )}

        {/* rest of your buttons and layout... */}
      </div>
    </div>
  );
}

export default Home;
