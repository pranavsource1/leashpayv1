import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#f5f7fa" }}>
        <nav style={{
          background: "#003087", color: "white", padding: "12px 24px",
          display: "flex", alignItems: "center", gap: "24px", fontSize: "14px"
        }}>
          <Link href="/" style={{ color: "white", textDecoration: "none", fontWeight: "bold", fontSize: "18px" }}>
            🔒 LeashPay
          </Link>
          <Link href="/" style={{ color: "#ccc", textDecoration: "none" }}>Chat</Link>
          <Link href="/settings" style={{ color: "#ccc", textDecoration: "none" }}>Settings</Link>
          <Link href="/audit" style={{ color: "#ccc", textDecoration: "none" }}>Audit Log</Link>
          <Link href="/dashboard" style={{ color: "#ccc", textDecoration: "none" }}>Dashboard</Link>
          <Link href="/redteam" style={{ color: "#ccc", textDecoration: "none" }}>Red Team</Link>
        </nav>
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
