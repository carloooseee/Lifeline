import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc } from "firebase/firestore"; 
import { useNavigate } from "react-router-dom";
import { app } from "../firebase";
import "../styles/home.css";

const db = getFirestore(app);

function Home() {
  const [user, setUser] = useState(null);
  const [coords, setCoords] = useState(null);
  const [internetStatus, setInternetStatus] = useState(
    navigator.onLine ? "Online" : "Offline"
  );
  const navigate = useNavigate();
  const auth = getAuth(app);

  // Auth + load last saved location
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser && coords) {
        const dataToSave = {
          uid: currentUser.uid,
          coords: coords,
        };
        localStorage.setItem("lastLocation", JSON.stringify(dataToSave));
      }
    });

    // Load from localStorage
    const savedData = localStorage.getItem("lastLocation");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.coords) {
          setCoords(parsed.coords);
        }
        if (parsed.uid && !user) {
          setUser({ uid: parsed.uid });
        }
      } catch (err) {
        console.error("Error parsing lastLocation:", err);
      }
    }

    return () => unsubscribe();
  }, [auth]);

  // Help Request Button
  const sendHelpRequest = async () => {
    let fallbackCoords = null;
    const savedData = localStorage.getItem("lastLocation");

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.coords) fallbackCoords = parsed.coords;
      } catch (err) {
        console.error("Error parsing lastLocation:", err);
      }
    }

    const alertData = {
      user: user
        ? user.isAnonymous
          ? `Guest (Temporary ID: ${user.uid})`
          : user.email
        : "Unknown User",
      coords: coords || fallbackCoords || { error: "No location shared" },
      message: "HELP",
      time: new Date().toISOString(),
    };

    if (navigator.onLine) {
      try {
        await addDoc(collection(db, "Alerts"), alertData);
        alert("Help request sent to Firebase!");
      } catch (err) {
        console.error("Error writing to Firestore:", err);
        localStorage.setItem("pendingAlert", JSON.stringify(alertData));
        alert("Offline, alert queued locally.");
      }
    } else {
      localStorage.setItem("pendingAlert", JSON.stringify(alertData));
      alert("Offline, alert queued locally.");
    }
  };

  const syncPendingAlert = async () => {
    const pending = localStorage.getItem("pendingAlert");
    if (pending && navigator.onLine) {
      try {
        const alertData = JSON.parse(pending);
        await addDoc(collection(db, "Alerts"), alertData);
        localStorage.removeItem("pendingAlert");
        console.log("Pending alert synced to Firestore");
      } catch (err) {
        console.error("Failed to sync pending alert:", err);
      }
    }
  };

  // Share Location Button
  const handleShareLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newCoords = { latitude, longitude };
        setCoords(newCoords);

        if (user) {
          const dataToSave = {
                user: user
                  ? user.isAnonymous
                    ? `Guest (Temporary ID: ${user.uid})`
                    : user.email
                  : "Unknown User",
                coords: coords || { error: "No location shared" },
                message: "HELP",
                time: new Date().toISOString(),
          };
          localStorage.setItem("lastLocation", JSON.stringify(dataToSave));
        }
      },
      (err) => {
        console.error(err.message);
        setCoords({ error: err.message });
      }
    );
  };


 // Online/offline status
function handleInternetStatus() {
  const nowOnline = navigator.onLine;
  setInternetStatus(nowOnline ? "Online" : "Offline");

  // Retry Sync Pending Alerts 
  // ANGAS POTA, ETO PAGMAMALAKE NATEN 3 LINES OF CODE
  if (nowOnline) {
    syncPendingAlert();
  }
}


  useEffect(() => {
    handleInternetStatus();
    window.addEventListener("online", handleInternetStatus);
    window.addEventListener("offline", handleInternetStatus);

    return () => {
      window.removeEventListener("online", handleInternetStatus);
      window.removeEventListener("offline", handleInternetStatus);
    };
  }, []);

  return (
    <div className="Home">
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
        Status:{" "}
        <span
          style={{ color: internetStatus === "Online" ? "#6baf26" : "red" }}
        >
          <b>{internetStatus}</b>
        </span>
      </p>
      {/* Send Help Request Button */}
      <button className="helpButton" onClick={sendHelpRequest}>
        Send Help
      </button>
      {/* Store Location in Local Storage Button */}
      <button onClick={handleShareLocation}>Store Information</button>
      {coords && !coords.error && (
        <p>
          Last known Coordinates - Latitude: {coords.latitude}, Longitude:{" "}
          {coords.longitude}
        </p>
      )}
      {coords?.error && <p>Error: {coords.error}</p>}
      {/* View Alerts */}
      <button className="viewButton" onClick={() => navigate("/reports")}>
        View Alert
      </button>
      <a className="logoutButton" onClick={() => navigate("/")}>log out</a>
    </div>
  );
}

export default Home;
