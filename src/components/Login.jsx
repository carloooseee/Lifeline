import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInAnonymously,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { app } from "../firebase";
import "../styles/login.css";
import rescueImg from "../assets/Rescue.png";
import eyeIcon from "../assets/eye.png";
import googleIcon from "../assets/google-icon.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const auth = getAuth(app);

  // ------------------------------------------------------------------
  // UTIL — Load saved anonymous user for offline login
  // ------------------------------------------------------------------
  const getSavedAnon = () => {
    try {
      const stored = localStorage.getItem("anonUser");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  // ------------------------------------------------------------------
  // AUTO-GENERATE an anonymous UID when the user is ONLINE
  // So offline guest login ALWAYS works later
  // ------------------------------------------------------------------
  useEffect(() => {
    const saved = getSavedAnon();

    if (navigator.onLine && !saved) {
      signInAnonymously(auth)
        .then((res) => {
          localStorage.setItem(
            "anonUser",
            JSON.stringify({
              uid: res.user.uid,
              createdAt: Date.now(),
            })
          );
        })
        .catch(() => {});
    }
  }, []);

  // ------------------------------------------------------------------
  // GOOGLE LOGIN
  // ------------------------------------------------------------------
  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      navigate("/home");
    } catch (err) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setError(err.message);
      }
    }
  };

  // ------------------------------------------------------------------
  // EMAIL LOGIN
  // ------------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/home");
    } catch (err) {
      setError(err.message);
    }
  };

  // ------------------------------------------------------------------
  // SIGN UP NEW USER
  // ------------------------------------------------------------------
  const handleSignup = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Account created successfully!");
      navigate("/home");
    } catch (err) {
      setError(err.message);
    }
  };

  // ------------------------------------------------------------------
  // GUEST LOGIN (ONLINE + OFFLINE SUPPORT)
  // ------------------------------------------------------------------
  const handleGuest = async () => {
    setError(null);

    const saved = getSavedAnon();

    // =============================
    // OFFLINE MODE
    // =============================
    if (!navigator.onLine) {
      if (saved) {
        console.log("Offline login using saved anonymous uid:", saved.uid);
        navigate("/home");
        return;
      } else {
      setError("Guest mode requires an initial internet connection to set up your guest session. Please connect to the internet for the first time.");
        return;
      }
    }

    // =============================
    // ONLINE MODE (create or use existing)
    // =============================
    try {
      const userCred = await signInAnonymously(auth);

      localStorage.setItem(
        "anonUser",
        JSON.stringify({
          uid: userCred.user.uid,
          createdAt: Date.now(),
        })
      );

      navigate("/home");
    } catch (err) {
      setError("Guest login failed: " + err.message);
    }
  };

  // ------------------------------------------------------------------
  // RENDER UI
  // ------------------------------------------------------------------
  return (
    <div className="login-page">
      <div className="logo">
        <h1>
          <span className="life">Life</span>
          <span className="line">Line</span>
        </h1>
        <p>Be safer today—with<br />reliable Lifeline</p>
      </div>

      <div className="hero-section">
        <img src={rescueImg} alt="Rescue" />
      </div>

      <div className="login-panel">
        <h1>{isLogin ? "Nice to see you again!" : "Create your Lifeline account"}</h1>

        {error && <p className="error">{error}</p>}

        <form onSubmit={isLogin ? handleLogin : handleSignup}>
          <label className="input-label">{isLogin ? "Email" : "Email"}</label>
          <input
            type="email"
            placeholder="Email or phone number"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="input-label">Password</label>
          <div className="password-input-container">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={isLogin ? "Enter password" : "Password (min. 6 characters)"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <img
              src={eyeIcon}
              alt="Toggle password"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            />
          </div>

          {!isLogin && (
            <>
              <label className="input-label">Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </>
          )}

          <button type="submit" className="sign-in-btn">
            {isLogin ? "Sign in" : "Sign up"}
          </button>

          {isLogin && (
            <>
              <button type="button" className="guest-btn" onClick={handleGuest}>
                Continue as Guest
              </button>

              <button type="button" className="google-btn" onClick={handleGoogleLogin}>
                <img src={googleIcon} alt="Google" />
                Sign in with Google
              </button>
            </>
          )}
        </form>

        <p className="signup-link">
          {isLogin ? "Don’t have an account?" : "Already have an account?"}{" "}
          <a href="#" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Sign up now" : "Sign in now"}
          </a>
        </p>
      </div>
    </div>
  );
}
