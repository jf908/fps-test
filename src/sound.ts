import * as THREE from 'three';

export class SoundEngine {
  private listener = new THREE.AudioListener();
  private audioLoader = new THREE.AudioLoader();

  constructor(root: THREE.Object3D) {
    root.add(this.listener);
  }

  loadSound(sound: string): Promise<AudioBuffer> {
    return new Promise((res, rej) => {
      this.audioLoader.load(sound, (buffer) => {
        res(buffer);
      });
    });
  }

  createPositionAudio(): THREE.PositionalAudio {
    return new THREE.PositionalAudio(this.listener);
  }
}
