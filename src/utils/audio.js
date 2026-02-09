import * as Tone from 'tone';

let _toneStarted = false;

function ensureTone() {
  if (!_toneStarted) { Tone.start(); _toneStarted = true; }
}

export const playWhistle = () => {
  try {
    ensureTone();
    const synth = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 } }).toDestination();
    synth.triggerAttackRelease(3200, 0.5);
  } catch (e) { console.warn("Whistle:", e); }
};

export const vibrate = (pattern = [200, 100, 200]) => { try { navigator.vibrate?.(pattern); } catch(e) {} };
export const notifySub = () => { playWhistle(); vibrate([200, 100, 200]); };
export const notifyHalf = () => { playWhistle(); vibrate([200, 100, 300, 100, 200]); };
export const notifyEnd = () => { playWhistle(); vibrate([300, 150, 300, 150, 500]); };
export const notifyGoal = () => { vibrate([100, 50, 100, 50, 300]); };
