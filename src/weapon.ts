import type { SoundEngine } from './sound';
import { isMesh } from './util';

export class Weapon {
  private sound: SoundEngine;
  public object: THREE.Object3D;
  private muzzle: THREE.Object3D;
  public animation: THREE.AnimationAction;
  public audioBuffer?: AudioBuffer;

  private muzzlePeriod = 0.05;
  private muzzleTime = 0;

  constructor(
    soundEngine: SoundEngine,
    object: THREE.Object3D,
    muzzle: THREE.Object3D,
    animation: THREE.AnimationAction,
    loadBuffer: Promise<AudioBuffer>
  ) {
    this.sound = soundEngine;
    this.object = object;
    this.muzzle = muzzle;
    this.animation = animation;

    this.object.add(muzzle);

    loadBuffer.then((buffer) => {
      this.audioBuffer = buffer;
    });

    this.muzzle.visible = false;
  }

  fire() {
    this.animation.play();
    this.animation.reset();

    if (this.audioBuffer) {
      const audio = this.sound.createPositionAudio();
      audio.setBuffer(this.audioBuffer);
      this.object.add(audio);
      audio.play();

      audio.onEnded = () => {
        audio.isPlaying = false;
        this.object.remove(audio);
      };
    }

    this.muzzle.visible = true;
    this.muzzleTime = 0;
    this.muzzle.scale.set(1, 1, 1);
  }

  update(dt: number) {
    if (this.muzzle.visible) {
      if (this.muzzleTime >= this.muzzlePeriod) {
        this.muzzle.visible = false;
      } else {
        let scale = (this.muzzlePeriod - this.muzzleTime) / this.muzzlePeriod;
        this.muzzle.scale.set(scale, scale, scale);
      }
      this.muzzleTime += dt;
    }
  }
}
