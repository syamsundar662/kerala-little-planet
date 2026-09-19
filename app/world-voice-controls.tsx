'use client';
import { useEffect } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import type { createWorldVoice, WorldVoiceState } from './world-voice';
import './world-voice.css';
export default function WorldVoiceControls({
  voice,
  state,
  available,
  paused,
}: {
  voice?: ReturnType<typeof createWorldVoice>;
  state: WorldVoiceState;
  available: boolean;
  paused: boolean;
}) {
  const joined = state.status === 'ready';
  useEffect(() => {
    if (!joined || paused) return;
    const down = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.code !== 'KeyV' ||
        event.repeat ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)))
      )
        return;
      event.preventDefault();
      voice?.hold(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'KeyV') voice?.hold(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      voice?.hold(false);
    };
  }, [voice, joined, paused]);
  return (
    <section
      className="world-voice"
      aria-label="Nearby voice chat"
      data-voice-status={state.status}
      data-connected={state.connected}
    >
      <div className="world-voice-buttons">
        {!joined ? (
          <button
            disabled={!available && state.status !== 'requesting'}
            onClick={() =>
              state.status === 'requesting'
                ? voice?.disable()
                : void voice?.enable()
            }
          >
            <Mic size={16} />
            {state.status === 'requesting'
              ? 'Cancel microphone request'
              : 'Join voice'}
          </button>
        ) : (
          <>
            <button
              aria-label={
                state.transmitting ? 'Mute microphone' : 'Unmute microphone'
              }
              aria-pressed={state.transmitting}
              disabled={paused}
              onClick={() => voice?.setMicrophone(!state.transmitting)}
            >
              {state.transmitting ? <Mic size={16} /> : <MicOff size={16} />}
              <span>{state.transmitting ? 'Mic on' : 'Mic muted'}</span>
            </button>
            <button
              className="world-voice-hold"
              disabled={paused}
              aria-label="Hold to talk"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                voice?.hold(true);
              }}
              onPointerUp={() => voice?.hold(false)}
              onPointerCancel={() => voice?.hold(false)}
              onLostPointerCapture={() => voice?.hold(false)}
              onKeyDown={(event) => {
                if (['Space', 'Enter'].includes(event.code)) {
                  event.preventDefault();
                  voice?.hold(true);
                }
              }}
              onKeyUp={(event) => {
                if (['Space', 'Enter'].includes(event.code)) voice?.hold(false);
              }}
              onBlur={() => voice?.hold(false)}
            >
              Hold to talk <kbd>V</kbd>
            </button>
            <button
              aria-label="Leave voice chat"
              title="Leave voice chat"
              onClick={() => voice?.disable()}
            >
              <PhoneOff size={16} />
            </button>
          </>
        )}
      </div>
      <output aria-live="polite">
        {state.error ||
          (joined
            ? paused
              ? 'Microphone paused'
              : state.localSpeaking
                ? 'You’re speaking'
                : state.connected
                  ? `${state.connected} connected nearby`
                  : state.connecting
                    ? 'Connecting voice…'
                    : 'Waiting for nearby players to join voice'
            : state.status === 'requesting'
              ? 'Allow microphone access in your browser'
              : available
                ? 'Talk with players within 55 metres'
                : 'Voice available when multiplayer connects')}
      </output>
      {state.playbackBlocked && joined && (
        <button onClick={() => void voice?.resumePlayback()}>
          Tap to hear voice
        </button>
      )}
      {!!state.peers.length && (
        <details>
          <summary>People in voice ({state.peers.length})</summary>
          <ul>
            {state.peers.map((peer) => (
              <li key={peer.id}>
                <span>
                  {peer.speaking ? '● ' : ''}
                  {peer.name}
                </span>
                <button
                  aria-label={`${peer.muted ? 'Unmute' : 'Mute'} ${peer.name}`}
                  aria-pressed={peer.muted}
                  onClick={() => voice?.mutePeer(peer.id, !peer.muted)}
                >
                  {peer.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
