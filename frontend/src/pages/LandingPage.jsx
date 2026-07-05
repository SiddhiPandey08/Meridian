import React, { useState } from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function SpinningMark({ size = 360 }) {
  const ringRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tween = gsap.to(ringRef.current, {
      rotation: 360,
      duration: 18,
      repeat: -1,
      ease: "linear",
      svgOrigin: "200 200",
    });

    return () => tween.kill();
  }, []);

  const repeated = "MERIDIAN • CONNECT • COLLABORATE • CREATE • MERIDIAN • ";
  return (
    <div className="spinningMark">
      <svg width={size} height={size} viewBox="0 0 300 300" fill="none">
        <defs>
          <path
            id="meridianCircle"
            d="
    M150,150
    m-110,0
    a110,110 0 1,1 220,0
    a110,110 0 1,1 -220,0
  "
          />
        </defs>

        {/* Rotating Text */}
        <g ref={ringRef}>
          <text
            fill="var(--rust)"
            fontSize="17"
            fontWeight="700"
            letterSpacing="3"
            fontFamily="var(--font-body)"
            dominantBaseline="middle"
            textAnchor="middle"
          >
            <textPath
              href="#meridianCircle"
              startOffset="50%"
              textAnchor="middle"
            >
              {repeated}
            </textPath>
          </text>
        </g>

        {/* Center Circle */}
        <circle cx="150" cy="150" r="50" fill="var(--mustard)" />

        <g
          transform="translate(150 150)"
          stroke="var(--navy-dark)"
          strokeWidth="4.5"
          fill="none"
        >
          <circle r="24" />

          <path d="M0 -24V24" />
          <path d="M-24 0H24" />

          <ellipse rx="10" ry="24" />
          <ellipse rx="18" ry="24" />

          <ellipse rx="22" ry="6" cy="-8" />
          <ellipse rx="22" ry="6" cy="8" />
        </g>
      </svg>
    </div>
  );
}

function GuestJoinForm({ open, onClose }) {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  if (!open) return null;

  const handleJoin = () => {
    if (!code.trim()) return;
    navigate(`/${code.trim()}`);
  };

  return (
    <div className="guestJoinPanel">
      <input
        placeholder="Meeting code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        autoFocus
      />
      <div role="button" onClick={handleJoin}>
        <p>Join</p>
      </div>
      <button className="guestJoinClose" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}

function LandingPage() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray(".stepCard, .featureCard").forEach((el, i) => {
        gsap.from(el, {
          opacity: 0,
          y: 30,
          duration: 0.6,
          delay: i * 0.08,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        });
      });
    });

    // Recalculate trigger positions once fonts + images have actually settled
    document.fonts?.ready?.then(() => ScrollTrigger.refresh());
    window.addEventListener("load", () => ScrollTrigger.refresh());

    return () => {
      ctx.revert(); // kills tweens AND their ScrollTriggers cleanly
    };
  }, []);
  const [guestOpen, setGuestOpen] = useState(false);

  return (
    <div className="landingPageContainer">
      <nav>
        <div className="navHeader">
          <img src="/meridianLogo.png" alt="Meridian" className="logo" />
        </div>
        <div className="navList">
          <p onClick={() => setGuestOpen((v) => !v)}>Join as Guest</p>
          <Link
            to="/auth"
            state={{ formState: 1 }}
            style={{ textDecoration: "none" }}
          >
            <p>Register</p>
          </Link>
          <div role="button">
            <Link
              to="/auth"
              state={{ formState: 0 }}
              style={{ textDecoration: "none" }}
            >
              <p>Login</p>
            </Link>
          </div>
        </div>
        <GuestJoinForm open={guestOpen} onClose={() => setGuestOpen(false)} />
      </nav>

      <div className="landingMainContainer">
        <div>
          <h1>
            <span className="accent">Close the distance</span>, in real time
          </h1>
          <p className="tagline">
            A secure, elegant platform for meetings, collaboration, and
            conversations that matter.
          </p>
          <div role="button">
            <Link
              to="/auth"
              state={{ formState: 1 }}
              style={{ textDecoration: "none" }}
            >
              <p style={{ margin: 0 }}>Get Started</p>
            </Link>
          </div>
        </div>
        <SpinningMark size={400} />
      </div>

      <section className="howItWorks">
        <h2>Three steps, no friction</h2>
        <div className="stepsGrid">
          <div className="stepCard">
            <svg className="stepMark" viewBox="0 0 24 24">
              <path
                d="M12 2 L14 10.5 L22 12 L14 13.5 L12 22 L10 13.5 L2 12 L10 10.5 Z"
                fill="currentColor"
              />
            </svg>
            <h3>Create a room</h3>
            <p>Start a meeting in one click, no setup required.</p>
          </div>
          <div className="stepCard">
            <svg className="stepMark" viewBox="0 0 24 24">
              <path
                d="M12 2 L14 10.5 L22 12 L14 13.5 L12 22 L10 13.5 L2 12 L10 10.5 Z"
                fill="currentColor"
              />
            </svg>
            <h3>Share the link</h3>
            <p>Send the meeting code to anyone, anywhere.</p>
          </div>
          <div className="stepCard">
            <svg className="stepMark" viewBox="0 0 24 24">
              <path
                d="M12 2 L14 10.5 L22 12 L14 13.5 L12 22 L10 13.5 L2 12 L10 10.5 Z"
                fill="currentColor"
              />
            </svg>
            <h3>Talk face to face</h3>
            <p>Clear peer-to-peer video, straight from the browser.</p>
          </div>
        </div>
      </section>

      <section className="featuresSection">
        <img
          src="/meridianLogo.png"
          alt=""
          className="watermark"
          aria-hidden="true"
        />
        <div className="featuresGrid">
          <div className="featureCard">
            <h3>Peer-to-peer video</h3>
            <p>Direct connections keep calls fast and private.</p>
          </div>
          <div className="featureCard">
            <h3>No signup for guests</h3>
            <p>Join with just a name and a meeting code.</p>
          </div>
          <div className="featureCard">
            <h3>Meeting history</h3>
            <p>Every call you've joined, saved to your account.</p>
          </div>
        </div>
      </section>

      <section className="closingCta">
        <h2>Ready to close the distance?</h2>
        <div role="button">
          <Link to="/auth" state={{ formState: 1 }}>
            Get Started
          </Link>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
