import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../firebase";

function Home() {
  const [user, setUser] = useState(null);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, [auth]);

  return (
    <div className="Home">
      <h1>Welcome to the Emergency App</h1>
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
    </div>
  );
}

export default Home;
