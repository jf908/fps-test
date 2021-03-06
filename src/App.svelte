<script lang="ts">
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
  import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
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
  import type { PMREMGenerator, WebGLRenderTarget } from 'three';
  import { Weapon } from './weapon';
  import { SoundEngine } from './sound';
  import { settings } from './store';
  import Pause from './components/Pause.svelte';
  import { isMesh } from './util';

  let paused = true;

  let instructionsEl: HTMLElement;
  class Scene {
    private controls: FirstPersonControls;
    private clock: THREE.Clock;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private sound: SoundEngine;

    private world: World;
    private physicsMaterial: Material;
    private playerMaterial: Material;

    private bodies: Body[] = [];
    private meshes: THREE.Mesh[] = [];

    private mixers: THREE.AnimationMixer[] = [];

    private pmremGenerator: PMREMGenerator;
    private exrCubeRenderTarget: WebGLRenderTarget;

    private playerBody: Body;

    private thirdPerson = false;

    private spriteMat = new THREE.SpriteMaterial({ color: 0x0000ff });
    private debugPoints: THREE.Object3D[] = [];

    setup() {
      this.setupPhysics();
      this.clock = new THREE.Clock();
      this.scene = new THREE.Scene();

      this.camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        1000
      );
      if (this.thirdPerson) {
        this.camera.position.set(0, 0, 10);
      }

      this.sound = new SoundEngine(this.camera);

      this.setupLights();
      this.createGround();

      let boxSize = new Vec3(0.5, 0.5, 0.5);
      let boxShape = new Box(boxSize);
      let boxGeometry = new THREE.BoxGeometry(
        boxSize.x * 2,
        boxSize.y * 2,
        boxSize.z * 2
      );
      for (let i = 0; i <= 10; i++) {
        const material = this.createMaterial({
          color: 0xff0000,
          metalness: 0,
          roughness: i / 10,
        });

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
      this.playerBody.allowSleep = false;
      this.playerBody.addShape(playerShape);
      this.playerBody.position.set(0, 1, 10);

      if (this.thirdPerson) {
        const cyl = new THREE.CylinderGeometry(
          playerRadius,
          playerRadius,
          playerHeight,
          segments
        );
        const mesh = new THREE.Mesh(
          cyl,
          this.createMaterial({
            color: 0xeeeeee,
            metalness: 0,
            roughness: 1,
          })
        );
        const pos = this.playerBody.position;
        mesh.position.set(pos.x, pos.y, pos.z);
        this.scene.add(mesh);
        this.bodies.push(this.playerBody);
        this.meshes.push(mesh);
      }

      this.setupControls();
      this.world.addBody(this.playerBody);

      const textureLoader = new THREE.TextureLoader();
      const muzzle = textureLoader.load('assets/img/muzzle_02.png');
      const muzzleMat = new THREE.MeshBasicMaterial({
        color: 0xff8800,
        map: muzzle,
        transparent: true,
      });
      const muzzleSize = 0.3;
      const muzzleObj = new THREE.Mesh(
        new THREE.PlaneGeometry(muzzleSize, muzzleSize),
        muzzleMat
      );
      muzzleObj.position.set(0, 0.18, 0.05 + muzzleSize / 2);
      muzzleObj.setRotationFromEuler(
        new THREE.Euler(Math.PI / 2, Math.PI / 2, 0)
      );

      // TODO: Figure out how to show lights without frame lag
      // const muzzleLight = new THREE.PointLight(0xff8800, 1, 1);
      // muzzleLight.position.set(0, 0, 0.05);
      // muzzleObj.add(muzzleLight);

      // Animation Gun
      let mixer: THREE.AnimationMixer;
      const loader = new GLTFLoader();
      loader.load('assets/model/pistol.glb', (gltf) => {
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
        this.controls.setWeapon(
          new Weapon(
            this.sound,
            gltf.scene,
            muzzleObj,
            action,
            this.sound.loadSound('assets/sound/fire_1.wav')
          )
        );
      });

      this.setupRenderer();

      // Load HDR
      this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.pmremGenerator.compileEquirectangularShader();
      new EXRLoader()
        .setDataType(THREE.UnsignedByteType)
        .load('assets/hdr/city.exr', (texture) => {
          this.exrCubeRenderTarget = this.pmremGenerator.fromEquirectangular(
            texture
          );
          this.scene.background = this.exrCubeRenderTarget.texture;
          this.scene.environment = this.exrCubeRenderTarget.texture;

          texture.dispose();
        });

      // Crosshair
      const crosshairTex = textureLoader.load('assets/img/crosshair007.png');
      const crosshairMat = new THREE.SpriteMaterial({
        map: crosshairTex,
        color: 0x00ff00,
      });
      const crosshair = new THREE.Sprite(crosshairMat);
      const crosshairScale = 0.001;
      crosshair.scale.multiplyScalar(crosshairScale);
      crosshair.position.set(0, 0, -0.02);
      // this.scene.add(crosshair);
      this.camera.add(crosshair);

      document.body.appendChild(this.renderer.domElement);
      window.addEventListener('resize', () => this.onWindowResize(), false);

      // Setup store listeners
      settings.subscribe((settings) => {
        if (this.camera.fov === settings.fov) return;
        this.camera.fov = settings.fov;
        this.camera.updateProjectionMatrix();
      });
    }

    setupControls() {
      this.controls = new FirstPersonControls(this.camera, this.playerBody);
      this.scene.add(this.controls.getObject());

      this.controls.addEventListener('lock', () => {
        this.controls.enabled = true;
        paused = false;
      });

      this.controls.addEventListener('unlock', () => {
        this.controls.enabled = false;
        paused = true;
      });

      this.controls.addEventListener('fire', () => {
        let raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);

        const intersects = raycaster.intersectObjects(this.scene.children);
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (isMesh(hit.object)) {
            const index = this.meshes.indexOf(hit.object);
            if (index === -1) return;
            const body = this.bodies[index];

            const cameraLook = new THREE.Vector3();
            this.camera.getWorldDirection(cameraLook);
            cameraLook.normalize();

            const sprite = this.createDebugSprite();
            const arrowHelper = new THREE.ArrowHelper(cameraLook, hit.point);
            arrowHelper.add(sprite);
            this.addDebugPoint(arrowHelper);

            cameraLook.multiplyScalar(10);
            body.applyImpulse(
              new Vec3(cameraLook.x, cameraLook.y, cameraLook.z),
              new Vec3(hit.point.x, hit.point.y, hit.point.z)
            );
          }
        }
      });
    }

    setupPhysics() {
      this.world = new World();
      this.world.allowSleep = true;
      this.world.gravity.set(0, -25, 0);

      this.world.defaultContactMaterial.contactEquationStiffness = 1e9;
      this.world.defaultContactMaterial.contactEquationRelaxation = 4;

      const solver = new GSSolver();
      solver.iterations = 7;
      solver.tolerance = 0.01;
      this.world.solver = new SplitSolver(solver);

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
      const spotLight = new THREE.SpotLight(0xffffff, 100, 0, Math.PI / 4, 1);
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

      this.renderer.physicallyCorrectLights = true;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.outputEncoding = THREE.sRGBEncoding;

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

      const material = this.createMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.8,
      });
      const mesh = new THREE.Mesh(geometry, material);

      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    createMaterial(
      params: THREE.MeshStandardMaterialParameters
    ): THREE.MeshStandardMaterial {
      const mat = new THREE.MeshStandardMaterial(params);
      return mat;
    }

    createDebugSprite() {
      const point = new THREE.Sprite(this.spriteMat);
      point.scale.set(0.05, 0.05, 0.05);
      return point;
    }

    addDebugPoint(obj: THREE.Object3D) {
      this.scene.add(obj);
      this.debugPoints.push(obj);
      if (this.debugPoints.length > 5) {
        const point = this.debugPoints.shift();
        this.scene.remove(point);
      }
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
        this.world.step(1 / 144, delta);
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
    scene.setup();
  });
</script>

<Pause {paused} />
