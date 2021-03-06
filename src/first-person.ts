import * as THREE from 'three';
import { Body, ContactEquation, Vec3 } from 'cannon-es';
import { spring } from './spring';
import type { Vec2 } from 'three';
import type { Weapon } from './weapon';
import { settings } from './store';
export class FirstPersonControls extends THREE.EventDispatcher {
  enabled = false;
  cannonBody: Body;

  velocityFactor = 40;
  jumpVelocity = 9;

  mouseSensitivity = 5;

  pitchObject: THREE.Object3D;
  yawObject: THREE.Object3D;
  quaternion: THREE.Quaternion;

  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  canJump = false;

  velocity: Vec3;
  inputVelocity: THREE.Vector3;
  euler: THREE.Euler;

  isLocked = false;
  lockEvent = { type: 'lock' };
  unlockEvent = { type: 'unlock' };
  fireEvent = { type: 'fire' };

  mouse: Vec2 = { x: 0, y: 0 };

  weapon: Weapon | null;
  weaponSpring = spring({ x: 0, y: 0 });
  weaponPosSpring = spring({ x: 0, y: 0 });

  bobbingObject: THREE.Object3D;
  bobbingTime = 0;

  private static upVector = new THREE.Vector3(0, 1, 0);

  constructor(camera: THREE.Camera, cannonBody: Body) {
    super();

    this.cannonBody = cannonBody;

    // var eyeYPos = 2 // eyes are 2 meters above the ground

    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(camera);

    this.yawObject = new THREE.Object3D();
    this.yawObject.position.y = 2;
    this.yawObject.add(this.pitchObject);

    this.bobbingObject = new THREE.Object3D();
    this.pitchObject.add(this.bobbingObject);

    this.quaternion = new THREE.Quaternion();

    const contactNormal = new Vec3(); // Normal in the contact, pointing *out* of whatever the player touched
    const upAxis = new Vec3(0, 1, 0);
    this.cannonBody.addEventListener(
      'collide',
      (event: { contact: ContactEquation }) => {
        const { contact } = event;

        // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
        // We do not yet know which one is which! Let's check.
        if (contact.bi.id === this.cannonBody.id) {
          // bi is the player body, flip the contact normal
          contact.ni.negate(contactNormal);
        } else {
          // bi is something else. Keep the normal as it is
          contactNormal.copy(contact.ni);
        }

        // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
        if (contactNormal.dot(upAxis) > 0.5) {
          // Use a "good" threshold value between 0 and 1 here!
          this.canJump = true;
        }
      }
    );

    this.velocity = this.cannonBody.velocity;

    // Moves the camera to the cannon.js object position and adds velocity to the object if the run key is down
    this.inputVelocity = new THREE.Vector3();
    this.euler = new THREE.Euler();

    this.connect();

    settings.subscribe((settings) => {
      if (settings.mouseSensitivity !== this.mouseSensitivity) {
        this.mouseSensitivity = settings.mouseSensitivity;
      }
    });
  }

  connect() {
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerlockChange);
    document.addEventListener('pointerlockerror', this.onPointerlockError);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
  }

  disconnect() {
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerlockChange);
    document.removeEventListener('pointerlockerror', this.onPointerlockError);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
  }

  dispose() {
    this.disconnect();
  }

  lock() {
    document.body.requestPointerLock();
  }

  unlock() {
    document.exitPointerLock();
  }

  onPointerlockChange = () => {
    if (document.pointerLockElement) {
      this.dispatchEvent(this.lockEvent);
      this.isLocked = true;
    } else {
      this.dispatchEvent(this.unlockEvent);
      this.isLocked = false;
    }
  };

  onPointerlockError = (e) => {
    console.error('PointerLockControlsCannon: Unable to use Pointer Lock API');
  };

  onMouseDown = (event: MouseEvent) => {
    if (this.isLocked && event.button === 0 && this.weapon) {
      this.dispatchEvent(this.fireEvent);
      this.weapon.fire();
    }
  };

  onMouseMove = (event: MouseEvent) => {
    if (!this.enabled) {
      return;
    }

    this.mouse.x += event.movementX;
    this.mouse.y += event.movementY;
  };

  onKeyDown = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = true;
        break;

      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = true;
        break;

      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = true;
        break;

      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = true;
        break;

      case 'Space':
        if (this.canJump) {
          this.velocity.y = this.jumpVelocity;
        }
        this.canJump = false;
        break;
    }
  };

  onKeyUp = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = false;
        break;

      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = false;
        break;

      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = false;
        break;

      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = false;
        break;
    }
  };

  setWeapon(weapon: Weapon) {
    this.weapon = weapon;

    this.bobbingObject.add(weapon.object);
  }

  getObject() {
    return this.yawObject;
  }

  // getDirection() {
  //   const vector = new Vec3(0, 0, -1);
  //   vector.applyQuaternion(this.quaternion);
  //   return vector;
  // }

  update(dt: number) {
    if (this.enabled === false) {
      return;
    }

    this.inputVelocity.set(0, 0, 0);

    if (this.moveForward) {
      this.inputVelocity.z = -1;
    }
    if (this.moveBackward) {
      this.inputVelocity.z = 1;
    }

    if (this.moveLeft) {
      this.inputVelocity.x = -1;
    }
    if (this.moveRight) {
      this.inputVelocity.x = 1;
    }

    const yawDelta =
      ((this.mouse.x * 0.022 * this.mouseSensitivity) / 180) * Math.PI;
    this.yawObject.rotation.y -= yawDelta;
    const pitchDelta =
      ((this.mouse.y * 0.022 * this.mouseSensitivity) / 180) * Math.PI;
    this.pitchObject.rotation.x -= pitchDelta;

    this.pitchObject.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.pitchObject.rotation.x)
    );

    if (this.weapon) {
      let rot = this.weaponSpring(
        {
          x: THREE.MathUtils.clamp(yawDelta, -0.2, 0.2),
          y: THREE.MathUtils.clamp(pitchDelta, -0.2, 0.2),
        },
        dt
      );
      const rotScale = 3;
      this.weapon.object.setRotationFromEuler(
        new THREE.Euler(rot.y * rotScale, rot.x * rotScale + Math.PI, 0)
      );
      this.weapon.update(dt);
    }

    this.mouse.x = 0;
    this.mouse.y = 0;

    this.inputVelocity.applyAxisAngle(
      FirstPersonControls.upVector,
      this.yawObject.rotation.y
    );

    if (this.inputVelocity.length() > 0) {
      this.inputVelocity.normalize();
      this.inputVelocity.multiplyScalar(this.velocityFactor * dt);
    }

    if (this.weapon) {
      let pos: Vec2;
      if (this.inputVelocity.length() > 0) {
        pos = this.weaponPosSpring(
          {
            x: Math.sin(this.bobbingTime * 8 - Math.PI / 2) * 0.01,
            y: Math.abs(Math.sin(this.bobbingTime * 8)) * 0.02,
          },
          dt
        );
        this.bobbingTime += dt;
      } else {
        pos = this.weaponPosSpring({ x: 0, y: 0 }, dt);
        this.bobbingTime = 0;
      }
      this.bobbingObject.position.set(pos.x, pos.y, 0);
    }

    this.velocity.x *= Math.pow(1 - 0.9999, dt);
    this.velocity.y *= Math.pow(1 - 0.5, dt);
    this.velocity.z *= Math.pow(1 - 0.9999, dt);

    // Add to the object
    this.velocity.x += this.inputVelocity.x;
    this.velocity.z += this.inputVelocity.z;

    const p = this.cannonBody.position;
    this.yawObject.position.set(p.x, p.y, p.z);
  }
}
