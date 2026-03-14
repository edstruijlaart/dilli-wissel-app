let _ctx = null;

function getAudioContext() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

export const playWhistle = () => {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 3200;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01);  // attack
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);   // decay → sustain
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);     // release
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) { console.warn('Whistle:', e); }
};

export const vibrate = (pattern = [200, 100, 200]) => { try { navigator.vibrate?.(pattern); } catch(e) {} };
export const notifySub = () => { playWhistle(); vibrate([200, 100, 200]); };
export const notifyHalf = () => { playWhistle(); vibrate([200, 100, 300, 100, 200]); };
export const notifyEnd = () => { playWhistle(); vibrate([300, 150, 300, 150, 500]); };
export const notifyGoal = () => { vibrate([100, 50, 100, 50, 300]); };
