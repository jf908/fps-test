import { writable } from 'svelte/store';

type Settings = {
  fov: number;
  mouseSensitivity: number;
  masterVolume: number;
};

function defaultSettings(): Settings {
  return {
    fov: 70,
    mouseSensitivity: 5,
    masterVolume: 1,
  };
}

export let settings = writable(defaultSettings());
