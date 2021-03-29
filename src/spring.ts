import type { Vec2 } from 'three';

// Inspired by https://github.com/sveltejs/svelte/blob/master/src/runtime/motion/spring.ts

function springTick(
  lastValue: number,
  currentValue: number,
  targetValue: number,
  dt: number,
  stiffness: number,
  damping: number,
  invMass: number
) {
  dt = dt * 1000;
  const delta = targetValue - currentValue;
  const velocity = (currentValue - lastValue) / dt;
  const spring = stiffness * delta;
  const damper = damping * velocity;
  const acceleration = (spring - damper) * invMass;
  const d = (velocity + acceleration) * dt;
  return d + currentValue;
}

export function spring(value: Vec2, stiffness = 0.01, damping = 0.5) {
  let current = value;
  let last = value;

  let invMass = 1;

  return (target: Vec2, dt: number) => {
    let newCurrent = {
      x: springTick(
        last.x,
        current.x,
        target.x,
        dt,
        stiffness,
        damping,
        invMass
      ),
      y: springTick(
        last.y,
        current.y,
        target.y,
        dt,
        stiffness,
        damping,
        invMass
      ),
    };
    last = current;
    current = newCurrent;
    return newCurrent;
  };
}
