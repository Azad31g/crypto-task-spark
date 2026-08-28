import { useRef } from "react";

function Joystick({ onMove }: { onMove: (d: string) => void }) {
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    startX.current = e.clientX;
    startY.current = e.clientY;
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    e.preventDefault();
    e.stopPropagation();
    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 20) onMove("right");
      if (deltaX < -20) onMove("left");
    } else {
      if (deltaY > 20) onMove("down");
      if (deltaY < -20) onMove("up");
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = false;
    startX.current = 0;
    startY.current = 0;
  };

  const btn = (dir: string, label: string) => (
    <button
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onMove(dir)
      }}
      style={{
        width: 64,
        height: 64,
        fontSize: 28,
        background: '#166534',
        color: '#4ade80',
        border: '2px solid #4ade80',
        borderRadius: 12,
        cursor: 'pointer',
        touchAction: 'none',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '64px 64px 64px',
      gridTemplateRows: '64px 64px 64px',
      gap: 8,
      touchAction: 'none',
    }}>
      <div/>
      {btn('up', '↑')}
      <div/>
      {btn('left', '←')}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ background: '#1a1a1a', borderRadius: '50%', touchAction: 'none', cursor: 'grab' }}
      />
      {btn('right', '→')}
      <div/>
      {btn('down', '↓')}
      <div/>
    </div>
  )
}

export default Joystick
