export default function WordTimer({
  seconds,
  total,
}: {
  seconds: number;
  total: number;
}) {
  const pct = Math.max(0, Math.min(1, seconds / total));
  const color =
    seconds <= 5 ? "#ef4444" : seconds <= 10 ? "#FF7A18" : "#22c55e";
  const size = 96;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={`relative grid place-items-center ${seconds <= 5 ? "animate-pulse" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span
        className="absolute font-mono text-2xl font-black tabular-nums"
        style={{ color }}
      >
        {seconds}
      </span>
    </div>
  );
}
