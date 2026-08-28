import { AZOX_IMAGES } from "@/lib/azox-images";

type Phase = "idle" | "active" | "opened";

const COINS = Array.from({ length: 14 }, (_, i) => i);

export function BoxAnimation({ phase }: { phase: Phase }) {
  return (
    <div className="relative grid size-44 place-items-center">
      {phase === "active" ? (
        <span className="absolute inset-0 rounded-full bg-[#FF7A18]/25 blur-2xl azox-box-glow" />
      ) : null}
      {phase === "opened" ? (
        <span className="absolute inset-0 rounded-full bg-[#FFD166]/30 blur-3xl" />
      ) : null}

      <img
        src={AZOX_IMAGES.box}
        alt="AZOX mystery box"
        className={
          phase === "active"
            ? "relative size-36 azox-box-shake drop-shadow-[0_0_30px_#FF7A18]"
            : phase === "opened"
              ? "relative size-36 azox-box-open"
              : "relative size-36 opacity-90"
        }
      />

      {phase === "opened"
        ? COINS.map((i) => (
            <span
              key={i}
              className="pointer-events-none absolute left-1/2 top-1/2 size-2.5 rounded-full bg-[#FFD166] azox-box-coin"
              style={{
                // @ts-expect-error CSS custom properties
                "--coin-x": `${Math.cos((i / COINS.length) * Math.PI * 2) * 110}px`,
                "--coin-y": `${Math.sin((i / COINS.length) * Math.PI * 2) * 110}px`,
                animationDelay: `${i * 25}ms`,
              }}
            />
          ))
        : null}
    </div>
  );
}

export default BoxAnimation;
