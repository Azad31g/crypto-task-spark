import type { FloatingPoint } from "./useClickerLogic";

export default function FloatingPoints({ items }: { items: FloatingPoint[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {items.map((p) => (
        <span
          key={p.id}
          className="clicker-float absolute text-xl font-black"
          style={{ left: p.x, top: p.y, color: "#FFD700" }}
        >
          +{p.value}
        </span>
      ))}
    </div>
  );
}
