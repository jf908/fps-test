<script lang="ts">
  import * as THREE from 'three';
  import { Body, Box, Material, Plane, Sphere, Vec3, World } from 'cannon-es';
  import { FirstPersonControls } from './first-person';
  import { onMount } from 'svelte';

  let instructionsEl: HTMLElement;
  class Scene {
    private controls: FirstPersonControls;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;

    private world: World;

    private boxBodies: Body[] = [];
    private boxMeshes: THREE.Mesh[] = [];

    private lastTime = performance.now();

    private playerBody: Body;

    setup(fixedElement: HTMLElement) {
      this.setupPhysics();
      this.scene = new THREE.Scene();

      this.camera = new THREE.PerspectiveCamera(
        80,
        window.innerWidth / window.innerHeight,
        0.01,
        1000
      );
      // this.camera.position.set(0, 0, 10);

      this.setupLights();

      this.createGround();

      const material = new THREE.MeshLambertMaterial({ color: 0xdddddd });

      let boxSize = new Vec3(1, 1, 1);
      let boxShape = new Box(boxSize);
      let boxGeometry = new THREE.BoxGeometry(
        boxSize.x * 2,
        boxSize.y * 2,
        boxSize.z * 2
      );
      for (let i = 0; i < 4; i++) {
        const x = i * 3;
        const y = 3;
        const z = 0;
        const boxBody = new Body({ mass: 5 });
        boxBody.addShape(boxShape);
        const mesh = new THREE.Mesh(boxGeometry, material);
        this.world.addBody(boxBody);
        this.scene.add(mesh);
        boxBody.position.set(x, y, z);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.boxBodies.push(boxBody);
        this.boxMeshes.push(mesh);
      }

      // User
      const radius = 1.3;
      const playerShape = new Sphere(radius);
      const physicsMaterial = new Material('physics');
      this.playerBody = new Body({ mass: 5, material: physicsMaterial });
      this.playerBody.addShape(playerShape);
      this.playerBody.position.set(0, 5, 0);
      this.playerBody.linearDamping = 0.9;

      this.setupControls(fixedElement);
      this.world.addBody(this.playerBody);

      this.setupRenderer();
      document.body.appendChild(this.renderer.domElement);
      window.addEventListener('resize', () => this.onWindowResize, false);
    }

    setupControls(fixedElement: HTMLElement) {
      this.controls = new FirstPersonControls(this.camera, this.playerBody);
      this.scene.add(this.controls.getObject());

      fixedElement.addEventListener('click', () => {
        this.controls.lock();
      });

      this.controls.addEventListener('lock', () => {
        this.controls.enabled = true;
      });

      this.controls.addEventListener('unlock', () => {
        this.controls.enabled = false;
      });
    }

    setupPhysics() {
      this.world = new World();
      this.world.gravity.set(0, -9.81, 0);
    }

    setupLights() {
      const ambient = new THREE.AmbientLight(0x333333);
      this.scene.add(ambient);
      const spotLight = new THREE.SpotLight(0xffffff);
      spotLight.position.set(0, 100, 0);
      spotLight.target.position.set(0, 0, 0);
      spotLight.castShadow = true;
      this.scene.add(spotLight);
    }

    setupRenderer() {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);

      this.renderer.shadowMap.enabled = true;

      this.renderer.setAnimationLoop((dt) => {
        this.draw(dt);
      });
    }

    createGround() {
      const body = new Body({ mass: 0 });
      const shape = new Plane();
      body.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI / 2);
      body.addShape(shape);
      this.world.addBody(body);

      const geometry = new THREE.PlaneGeometry(300, 300, 50, 50);
      geometry.rotateX(-Math.PI / 2);

      const material = new THREE.MeshLambertMaterial({ color: 0xdddddd });
      const mesh = new THREE.Mesh(geometry, material);

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    draw(dt: number) {
      const deltaTime = performance.now() - this.lastTime;
      this.lastTime = performance.now();
      this.world.step(deltaTime);

      if (this.controls.enabled) {
        for (let i = 0; i < this.boxBodies.length; i++) {
          const pos = this.boxBodies[i].position;
          this.boxMeshes[i].position.set(pos.x, pos.y, pos.z);
          const quat = this.boxBodies[i].quaternion;
          this.boxMeshes[i].quaternion.set(quat.x, quat.y, quat.z, quat.w);
        }
      }

      this.controls.update(deltaTime);
      this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  const scene = new Scene();
  onMount(() => {
    scene.setup(instructionsEl);
  });
</script>

<div id="instructions" bind:this={instructionsEl}>
  <p>Click</p>
</div>

<style>
  #instructions {
    position: fixed;
    width: 100vw;
    height: 100vh;
    top: 0;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
</style>
