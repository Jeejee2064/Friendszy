export function MessageStatusTicks({
  status,
  label,
}: {
  status: "sent" | "delivered" | "read";
  label?: string;
}) {
  const color = status === "read" ? "var(--teal2)" : "var(--muted)";

  return (
    <svg
      viewBox="0 0 16 11"
      width="16"
      height="11"
      fill="none"
      color={color}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {status === "sent" ? (
        <path
          d="M3 6.2 5.6 8.8 12 2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path
            d="M1 6.2 3.6 8.8 10 2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 6.2 7.6 8.8 14 2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
