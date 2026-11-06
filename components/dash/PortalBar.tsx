"use client";
export default function PortalBar() {
  return (
    <button
      className="btn btn-ghost mt-8"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        window.location.replace("/masuk");
      }}
    >
      Keluar
    </button>
  );
}
