import { writable } from 'svelte/store';

type Settings = {
  fov: number;
};

function defaultSettings(): Settings {
  return {
    fov: 70,
  };
}

export let settings = writable(defaultSettings());
