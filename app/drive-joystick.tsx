'use client';
import { useEffect, useRef } from 'react';
export default function DriveJoystick({
  onMove,
  disabled,
}: {
  onMove: (x: number, y: number) => void;
  disabled: boolean;
}) {
  const root = useRef<HTMLFieldSetElement>(null),
    pointer = useRef<number | null>(null),
    callback = useRef(onMove);
  useEffect(() => {
    callback.current = onMove;
  }, [onMove]);
  const reset = () => {
    pointer.current = null;
    root.current?.style.setProperty('--stick-x', '0px');
    root.current?.style.setProperty('--stick-y', '0px');
    callback.current(0, 0);
  };
  useEffect(() => {
    const stop = () => reset();
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
      callback.current(0, 0);
    };
  }, []);
  useEffect(() => {
    if (disabled) reset();
  }, [disabled]);
  const move = (event: React.PointerEvent<HTMLFieldSetElement>) => {
    if (pointer.current !== event.pointerId || disabled) return;
    const box = event.currentTarget.getBoundingClientRect(),
      radius = box.width * 0.32;
    let x = (event.clientX - box.left - box.width / 2) / radius,
      y = (event.clientY - box.top - box.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    root.current?.style.setProperty('--stick-x', `${x * radius}px`);
    root.current?.style.setProperty('--stick-y', `${y * radius}px`);
    const magnitude = Math.min(1, length),
      strength = Math.max(0, (magnitude - 0.12) / 0.88);
    callback.current(
      magnitude ? (x / magnitude) * strength : 0,
      magnitude ? (-y / magnitude) * strength : 0,
    );
  };
  return (
    <fieldset
      className="drive-joystick"
      ref={root}
      aria-label="Movement joystick"
      aria-disabled={disabled}
      onPointerDown={(e) => {
        if (disabled || pointer.current !== null) return;
        e.preventDefault();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={(e) => {
        if (pointer.current === e.pointerId) reset();
      }}
      onPointerCancel={(e) => {
        if (pointer.current === e.pointerId) reset();
      }}
      onLostPointerCapture={(e) => {
        if (pointer.current === e.pointerId) reset();
      }}
    >
      <span className="drive-joystick-guide" aria-hidden="true">
        ↑
      </span>
      <span className="drive-joystick-thumb" aria-hidden="true" />
      <span className="drive-joystick-caption">
        Drag to move · release to stop
      </span>
    </fieldset>
  );
}
