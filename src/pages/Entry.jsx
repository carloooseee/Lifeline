import Login from "../components/Login";
import '../styles/Entry.css';

export default function Entry() {
  return (
    <div className="area">
      <div className="area-box">

        {/* Login Component */}
        <Login />

        {/* Later you can add CreateAccount below */}
        {/* <CreateAccount /> */}
      </div>
    </div>
  );
}
