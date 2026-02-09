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

export const playApplause = () => {
  try {
    ensureTone();
    // Applaus = gefilterde noise bursts met fade-in/fade-out
    const noise = new Tone.Noise('white').start();
    const filter = new Tone.Filter({ frequency: 3000, type: 'lowpass', rolloff: -24 });
    const env = new Tone.AmplitudeEnvelope({ attack: 0.3, decay: 0.4, sustain: 0.6, release: 0.8, attackCurve: 'exponential', releaseCurve: 'exponential' });
    const vol = new Tone.Volume(-8); // iets zachter dan fluitsignaal
    noise.connect(filter);
    filter.connect(env);
    env.connect(vol);
    vol.toDestination();
    env.triggerAttackRelease(1.8);
    // Cleanup na 3 seconden
    setTimeout(() => { noise.stop(); noise.dispose(); filter.dispose(); env.dispose(); vol.dispose(); }, 3000);
  } catch (e) { console.warn("Applause:", e); }
};

export const vibrate = (pattern = [200, 100, 200]) => { try { navigator.vibrate?.(pattern); } catch(e) {} };
export const notifySub = () => { playWhistle(); vibrate([200, 100, 200]); };
export const notifyHalf = () => { playWhistle(); vibrate([200, 100, 300, 100, 200]); };
export const notifyEnd = () => { playWhistle(); vibrate([300, 150, 300, 150, 500]); };
export const notifyGoal = () => { playApplause(); vibrate([100, 50, 100, 50, 300]); };
