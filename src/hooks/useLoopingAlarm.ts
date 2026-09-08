import { useEffect } from 'react';
import { useAudioPlayer } from 'expo-audio';

// Bundled locally so it works with zero network dependency and can't
// break if a remote asset host ever goes down. Must be a real audio
// file you provide — see the project README for format/duration
// guidance. Used both here (Layer 1: loops indefinitely while the app
// is open/backgrounded-but-alive) and as the native notification sound
// (Layer 2: plays once per push, see app.json + the alert-repeats
// migration) — same file, two different playback contexts.
const ALARM_SOUND = require('../../assets/sounds/order_alert.wav');

/**
 * Plays ALARM_SOUND on a continuous loop for as long as `active` is
 * true, and stops the instant it becomes false. No time limit — this
 * is Layer 1 of the alert system (app open or backgrounded-but-alive),
 * where there is no OS restriction on loop duration; that ceiling only
 * applies to native push notification sounds (see Layer 2), not to
 * audio your own JS code is actively controlling.
 */
export function useLoopingAlarm(active: boolean) {
  const player = useAudioPlayer(ALARM_SOUND);

  // Configure looping once, when the player is created.
  useEffect(() => {
    player.loop = true;
  }, [player]);

  useEffect(() => {
    if (active) {
      player.seekTo(0);
      player.play();
    } else {
      player.pause();
    }
  }, [active, player]);
}
