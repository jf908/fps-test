import type { SoundEngine } from './sound';

export class Weapon {
  private sound: SoundEngine;
  public object: THREE.Object3D;
  public animation: THREE.AnimationAction;
  public audioBuffer?: AudioBuffer;

  constructor(
    soundEngine: SoundEngine,
    object: THREE.Object3D,
    animation: THREE.AnimationAction,
    loadBuffer: Promise<AudioBuffer>
  ) {
    this.sound = soundEngine;
    this.object = object;
    this.animation = animation;

    loadBuffer.then((buffer) => {
      this.audioBuffer = buffer;
    });
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
  }
}
