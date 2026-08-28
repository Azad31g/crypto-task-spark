/** Animated 3D perspective grid tunnel background. */
export function GameGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
      {/* floor */}
      <div
        className="absolute inset-x-0 bottom-0 h-[60%]"
        style={{
          perspective: "400px",
          perspectiveOrigin: "50% 0%",
        }}
      >
        <div
          className="absolute inset-0 animate-[takbom-grid_3s_linear_infinite]"
          style={{
            transform: "rotateX(70deg)",
            transformOrigin: "50% 0%",
            backgroundImage:
              "linear-gradient(to right, #0A3A0A 1px, transparent 1px), linear-gradient(to bottom, #0A3A0A 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>
      {/* ceiling */}
      <div
        className="absolute inset-x-0 top-0 h-[45%]"
        style={{ perspective: "400px", perspectiveOrigin: "50% 100%" }}
      >
        <div
          className="absolute inset-0 animate-[takbom-grid_4s_linear_infinite]"
          style={{
            transform: "rotateX(-70deg)",
            transformOrigin: "50% 100%",
            backgroundImage:
              "linear-gradient(to right, #0A3A0A 1px, transparent 1px), linear-gradient(to bottom, #0A3A0A 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>
      {/* side walls */}
      <div
        className="absolute inset-y-0 left-0 w-[35%]"
        style={{ perspective: "400px", perspectiveOrigin: "100% 50%" }}
      >
        <div
          className="absolute inset-0 animate-[takbom-grid_5s_linear_infinite]"
          style={{
            transform: "rotateY(70deg)",
            transformOrigin: "100% 50%",
            backgroundImage:
              "linear-gradient(to right, #0A3A0A 1px, transparent 1px), linear-gradient(to bottom, #0A3A0A 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>
      <div
        className="absolute inset-y-0 right-0 w-[35%]"
        style={{ perspective: "400px", perspectiveOrigin: "0% 50%" }}
      >
        <div
          className="absolute inset-0 animate-[takbom-grid_5s_linear_infinite]"
          style={{
            transform: "rotateY(-70deg)",
            transformOrigin: "0% 50%",
            backgroundImage:
              "linear-gradient(to right, #0A3A0A 1px, transparent 1px), linear-gradient(to bottom, #0A3A0A 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>
      {/* depth vignette toward vanishing point */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </div>
  );
}
