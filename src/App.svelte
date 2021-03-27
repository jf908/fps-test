<script lang="ts">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
  import {
    Body,
    Box,
    ContactMaterial,
    Cylinder,
    GSSolver,
    Material,
    Plane,
    Sphere,
    SplitSolver,
    Vec3,
    World,
  } from 'cannon-es';
  import { FirstPersonControls } from './first-person';
  import { onMount } from 'svelte';

  function isMesh(obj: THREE.Object3D): obj is THREE.Mesh {
    return obj['isMesh'] === true;
  }

  let instructionsEl: HTMLElement;
  class Scene {
    private controls: FirstPersonControls;
    private clock: THREE.Clock;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private instructionsEl: HTMLElement;

    private world: World;
    private physicsMaterial: Material;
    private playerMaterial: Material;

    private bodies: Body[] = [];
    private meshes: THREE.Mesh[] = [];

    private mixers: THREE.AnimationMixer[] = [];

    private lastTime = performance.now();

    private playerBody: Body;

    private fov = 70;

    private thirdPerson = false;

    setup(instructionsEl: HTMLElement) {
      this.instructionsEl = instructionsEl;

      this.setupPhysics();
      this.clock = new THREE.Clock();
      this.scene = new THREE.Scene();

      this.camera = new THREE.PerspectiveCamera(
        this.fov,
        window.innerWidth / window.innerHeight,
        0.01,
        1000
      );
      if (this.thirdPerson) {
        this.camera.position.set(0, 0, 10);
      }

      this.setupLights();
      this.createGround();

      const material = new THREE.MeshLambertMaterial({ color: 0xdddddd });

      let boxSize = new Vec3(0.5, 0.5, 0.5);
      let boxShape = new Box(boxSize);
      let boxGeometry = new THREE.BoxGeometry(
        boxSize.x * 2,
        boxSize.y * 2,
        boxSize.z * 2
      );
      for (let i = 0; i < 10; i++) {
        const x = i * 2;
        const y = 5;
        const z = -3;
        const boxBody = new Body({ mass: 5, material: this.physicsMaterial });
        boxBody.addShape(boxShape);
        const mesh = new THREE.Mesh(boxGeometry, material);
        boxBody.position.set(x, y, z);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.addPhysicsObject(boxBody, mesh);
      }

      // User
      const playerRadius = 0.3;
      const playerHeight = 1.8;
      const segments = 10;
      const playerShape = new Cylinder(
        playerRadius,
        playerRadius,
        playerHeight,
        segments
      );
      this.playerBody = new Body({
        mass: 5,
        material: this.playerMaterial,
        angularDamping: 1,
      });
      this.playerBody.addShape(playerShape);
      this.playerBody.position.set(0, 1, 10);

      if (this.thirdPerson) {
        const cyl = new THREE.CylinderGeometry(
          playerRadius,
          playerRadius,
          playerHeight,
          segments
        );
        const mesh = new THREE.Mesh(cyl, material);
        const pos = this.playerBody.position;
        mesh.position.set(pos.x, pos.y, pos.z);
        this.scene.add(mesh);
        this.bodies.push(this.playerBody);
        this.meshes.push(mesh);
      }

      this.setupControls();
      this.world.addBody(this.playerBody);

      let mixer: THREE.AnimationMixer;
      const loader = new GLTFLoader();
      loader.load('pistol.glb', (gltf) => {
        mixer = new THREE.AnimationMixer(gltf.scene);
        const action = mixer.clipAction(gltf.animations[0]);
        action.setLoop(THREE.LoopOnce, 0);

        this.mixers.push(mixer);

        gltf.scene.traverse((child) => {
          if (isMesh(child)) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        const scale = 0.6;
        gltf.scene.scale.set(scale, scale, scale);
        gltf.scene.setRotationFromEuler(new THREE.Euler(0, Math.PI, 0));
        gltf.scene.position.set(0.3, -0.2, -0.5);
        this.scene.add(gltf.scene);
        this.controls.setWeapon([gltf.scene, action]);
      });

      this.setupRenderer();
      document.body.appendChild(this.renderer.domElement);
      window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    setupControls() {
      this.controls = new FirstPersonControls(this.camera, this.playerBody);
      this.scene.add(this.controls.getObject());

      this.instructionsEl.addEventListener('click', () => {
        this.controls.lock();
      });

      this.controls.addEventListener('lock', () => {
        this.controls.enabled = true;
        this.instructionsEl.style.display = 'none';
      });

      this.controls.addEventListener('unlock', () => {
        this.controls.enabled = false;
        this.instructionsEl.style.display = null;
      });
    }

    setupPhysics() {
      this.world = new World();
      this.world.gravity.set(0, -25, 0);

      this.world.defaultContactMaterial.contactEquationStiffness = 1e9;
      this.world.defaultContactMaterial.contactEquationRelaxation = 4;

      const solver = new GSSolver();
      solver.iterations = 7;
      solver.tolerance = 0.1;
      // hackery because I think types are broken
      this.world.solver = new SplitSolver(solver as SplitSolver);
      // this.world.solver = solver;

      this.physicsMaterial = new Material('physics');
      this.playerMaterial = new Material('physics');
      const physicsPhysics = new ContactMaterial(
        this.physicsMaterial,
        this.playerMaterial,
        {
          friction: 0,
          restitution: 0,
        }
      );
      this.world.addContactMaterial(physicsPhysics);
    }

    setupLights() {
      const ambient = new THREE.AmbientLight(0x555555);
      this.scene.add(ambient);
      const spotLight = new THREE.SpotLight(0xffffff, 0.9, 0, Math.PI / 4, 1);
      spotLight.position.set(10, 30, 10);
      spotLight.target.position.set(0, 0, 0);
      spotLight.castShadow = true;

      spotLight.shadow.camera.near = 5;
      spotLight.shadow.camera.far = 100;
      spotLight.shadow.camera.fov = 30;

      spotLight.shadow.mapSize.width = 8192;
      spotLight.shadow.mapSize.height = 8192;

      this.scene.add(spotLight);
    }

    setupRenderer() {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);

      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.renderer.setAnimationLoop((dt) => {
        this.draw(dt);
      });
    }

    createGround() {
      const body = new Body({ mass: 0, material: this.physicsMaterial });
      const shape = new Plane();
      body.addShape(shape);
      body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
      this.world.addBody(body);

      const geometry = new THREE.PlaneGeometry(100, 100, 50, 50);
      geometry.rotateX(-Math.PI / 2);

      const material = new THREE.MeshLambertMaterial({ color: 0xdddddd });
      const mesh = new THREE.Mesh(geometry, material);

      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    addPhysicsObject(body: Body, mesh: THREE.Mesh) {
      this.world.addBody(body);
      this.bodies.push(body);
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }

    draw(dt: number) {
      const delta = this.clock.getDelta();

      if (this.controls.enabled) {
        this.controls.update(delta);
        this.world.step(delta);
        for (let i = 0; i < this.bodies.length; i++) {
          const pos = this.bodies[i].position;
          this.meshes[i].position.set(pos.x, pos.y, pos.z);
          const quat = this.bodies[i].quaternion;
          this.meshes[i].quaternion.set(quat.x, quat.y, quat.z, quat.w);
        }
      }

      this.mixers.forEach((mixer) => mixer.update(delta));

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
  <div class="hover-box">
    <p>Click to play</p>
  </div>
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

  .hover-box {
    background: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 0.5em 1em;
    border-radius: 3px;
  }
</style>
