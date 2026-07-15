export function Notice({
  kind,
  message,
  className = "",
}: {
  kind: "success" | "error";
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${className}`}
      style={
        kind === "success"
          ? { background: "#e8f8f5", borderColor: "var(--border)", color: "var(--dark)" }
          : { background: "#fdecec", borderColor: "#f3c8c8", color: "#e55" }
      }
    >
      {message}
    </div>
  );
}
