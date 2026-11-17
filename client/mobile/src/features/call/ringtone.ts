import { Platform } from 'react-native';

/**
 * Phone-style ringing tone shared by both products.
 *
 * Outgoing VOIP calls play it as ringback until the peer joins; an incoming call that could not be
 * shown by the native ConnectionService plays it from the in-app surface. PSTN calls never use it:
 * the system dialer owns their ringback. Native audio is best-effort — a missing sound module must
 * never break the call, so every entry point is guarded.
 */
interface SoundHandle {
  play: (done?: (success: boolean) => void) => void;
  stop: (done?: (success: boolean) => void) => void;
  release: () => void;
  setNumberOfLoops: (loops: number) => void;
  setVolume: (volume: number) => void;
}

let sound: SoundHandle | null = null;
let loading = false;
let shouldRing = false;

function playLoaded(current: SoundHandle): void {
  try {
    current.play(() => undefined);
  } catch {
    // Audio focus was lost (another app or an active GSM call) — the UI still rings visually.
  }
}

function createSound(): void {
  if (sound || loading) return;
  loading = true;
  try {
    // Lazy require keeps the native module out of Jest/unit environments.
    const Sound = require('react-native-sound');
    try {
      Sound.setCategory('Playback', false);
    } catch {
      // Category is unavailable on some platforms; play() still works.
    }
    sound = new Sound(require('../../assets/callRingback.wav'), (error: unknown) => {
      loading = false;
      const current = sound;
      if (!current) return;
      if (error) {
        try {
          current.release();
        } catch {
          // Already released.
        }
        sound = null;
        return;
      }
      try {
        current.setNumberOfLoops(-1);
        current.setVolume(Platform.OS === 'android' ? 0.7 : 0.5);
      } catch {
        // Looping is optional; a single ring is still audible.
      }
      if (shouldRing) playLoaded(current);
    });
  } catch {
    loading = false;
    sound = null;
  }
}

/** Start looping the ringing tone. Safe to call repeatedly. */
export function startRinging(): void {
  shouldRing = true;
  if (sound) {
    playLoaded(sound);
    return;
  }
  createSound();
}

/** Stop the ringing tone. Safe to call when nothing is playing. */
export function stopRinging(): void {
  shouldRing = false;
  if (!sound) return;
  try {
    sound.stop(() => undefined);
  } catch {
    // Already stopped.
  }
}
