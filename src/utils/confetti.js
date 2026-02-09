export const fireConfetti = () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const colors = ["#16A34A","#22C55E","#FCD34D","#F97316","#EF4444","#3B82F6","#A855F7","#EC4899","#FFFFFF"];
  const pieces = Array.from({length: 120}, () => ({
    x: canvas.width * 0.5 + (Math.random() - 0.5) * 100,
    y: canvas.height * 0.5,
    vx: (Math.random() - 0.5) * 18,
    vy: -Math.random() * 22 - 5,
    r: Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 12,
    shape: Math.random() > 0.5 ? "rect" : "circle",
    gravity: 0.35 + Math.random() * 0.15,
    opacity: 1
  }));
  let frame = 0;
  const animate = () => {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
      p.vx *= 0.99; p.rot += p.rotV;
      if (frame > 40) p.opacity = Math.max(0, p.opacity - 0.02);
      if (p.opacity <= 0) return;
      alive = true;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color;
      if (p.shape === "rect") ctx.fillRect(-p.r, -p.r/2, p.r*2, p.r);
      else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI*2); ctx.fill(); }
      ctx.restore();
    });
    if (alive && frame < 120) requestAnimationFrame(animate);
    else { canvas.remove(); }
  };
  requestAnimationFrame(animate);
};
