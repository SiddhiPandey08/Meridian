import React from "react";
import "../App.css";
import { Link } from "react-router-dom";
function LandingPage() {
  return (
    <div className="landingPageContainer">
      <nav>
        <div className="navHeader">
          <h2>Apna Video Call</h2>
        </div>
        <div className="navList">
          <p>Join as Guest</p>
          <p>Register</p>
          <div role="button">
            <p>Login</p>
          </div>
        </div>
      </nav>
      <div className="landingMainContainer">
        <div>
          <div>
            <h1>
              <span style={{ color: "#FF9839" }}>Connect</span> with your loved
              Ones
            </h1>

            <p>Cover a distance by Apna Video Call</p>
            <div role="button">
              <Link to={"/auth"}>Get Started</Link>
            </div>
          </div>
        </div>
        <div></div>
      </div>
    </div>
  );
}

export default LandingPage;
