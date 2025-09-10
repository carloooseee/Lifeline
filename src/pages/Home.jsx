import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../firebase";
import '../styles/home.css';

function Home() {
  const [user, setUser] = useState(null);
  const [coords, setCoords] = useState(null);
  const auth = getAuth(app);
  
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);

    if (currentUser && coords) {
      // Always store as an object with uid + coords
      const dataToSave = {
        coords: coords,
      };
      localStorage.setItem("lastLocation", JSON.stringify(dataToSave));
    }
  });

  // Load saved location + uid
  const savedData = localStorage.getItem("lastLocation");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.coords) {
          setCoords(parsed.coords);
        }
        if (parsed.uid) {
          setUser({ uid: parsed.uid });
        }
      } catch (err) {
        console.error("Error parsing lastLocation:", err);
      }
  }

  return () => unsubscribe();
}, [auth, coords]);

// Help Request Buttonn
const sendHelpRequest = () => {
  const savedData = localStorage.getItem("lastLocation");
  let fallbackCoords = null;

  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      if (parsed.coords) {
        fallbackCoords = parsed.coords;
      }
    } catch (err) {
      console.error("Error parsing lastLocation:", err);
    }
  }

  const alertData = {
    user: user.isAnonymous
      ? `Guest (Temporary ID: ${user.uid})`
      : user.email,
    coords: coords
      ? coords
      : fallbackCoords
      ? fallbackCoords
      : { error: "No location shared" },
    message: "HELP",
    time: new Date().toISOString(),
  };

  localStorage.setItem("alert", JSON.stringify(alertData));
  alert("Help request sent!");
};


// Share Location Button
const handleShareLocation = () => {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      const newCoords = { latitude, longitude };
      setCoords(newCoords);

      if (user) {
        // Always save UID + coords together
        const dataToSave = {
          uid: user.uid,
          coords: newCoords,
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
const [internetStatus, setInternetStatus] = useState(navigator.onLine ? "Online" : "Offline");

  // Single function for handling status
  function handleInternetStatus() {
    setInternetStatus(navigator.onLine ? "Online" : "Offline");
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
        <span style={{ color: internetStatus === "Online" ? "#6baf26" : "red" }}>
          <b>{internetStatus}</b>
        </span>
      </p>
      <button className="helpButton" onClick={sendHelpRequest}>
        Send Help
      </button>
      <button onClick={handleShareLocation}>
        Store My Location
      </button>

      {coords && !coords.error && (
        <p>
          Last known Coordinates - Latitude: {coords.latitude}, Longitude: {coords.longitude}
        </p>
      )}
      {coords?.error && <p>Error: {coords.error}</p>}
    </div>
  );
}

export default Home;
