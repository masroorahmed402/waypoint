'use client';

const COLORS = ['#e6a53a', '#16263f', '#059669', '#d18f22', '#334155'];
const PIECES = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 8) * 0.08}s`,
  color: COLORS[i % COLORS.length],
  rotate: (i * 53) % 360,
}));

/** Pure-CSS confetti burst — no libraries. Mount briefly after a success moment. */
export default function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-10px] h-2.5 w-1.5 animate-[confettiFall_1.6s_ease-in_forwards]"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDelay: p.delay,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
