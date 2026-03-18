"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit() {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const from = searchParams.get("from") || "/";
      router.push(from);
    } else {
      setError(true);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F0E8", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#FAF8F3", border: "1px solid #DDD5C8", borderRadius: 8, padding: 40, width: 360, boxShadow: "0 8px 32px rgba(30,26,20,0.08)" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, marginBottom: 6 }}>The Workshop</div>
        <div style={{ fontSize: 13, color: "#8C8070", fontWeight: 300, marginBottom: 28 }}>Personal Dashboard · Enter password to continue</div>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          style={{ width: "100%", padding: "10px 12px", border: `1px solid ${error ? "#B5622A" : "#DDD5C8"}`, borderRadius: 4, fontSize: 14, fontFamily: "'Lato', sans-serif", outline: "none", boxSizing: "border-box", background: "#FAF8F3", marginBottom: 8 }}
        />
        {error && <div style={{ fontSize: 12, color: "#B5622A", marginBottom: 8 }}>Incorrect password</div>}
        <button onClick={handleSubmit}
          style={{ width: "100%", padding: "10px 0", background: "#1E1A14", color: "#F5F0E8", border: "none", borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Lato', sans-serif", marginTop: 8 }}>
          Enter →
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
