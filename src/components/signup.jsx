import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { app } from "../firebase";
import '../styles/signup.css';

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth(app);

  const handleSignup = async (e) => {
    e.preventDefault();

    // Simple password check
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

  return (
    <div className="login-page">
      <div className="logo">
        <h1><span className="life">Life</span><span className="line">Line</span></h1>
        <p>Join Lifeline—your safety starts here.</p>
      </div>

      <div className="hero-section">
        <img src="/pictures/Rescue.png" />
      </div>

      <div className="login-panel">
        <h1>Create your Lifeline account</h1>
        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSignup}>
          <input
            type="email"
            placeholder="Email or phone number"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button type="submit" className="sign-in-btn">Sign up</button>

          <p className="signup-link">
            Already have an account?{" "}
            <Link to="/">Sign in now</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
