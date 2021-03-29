export function isMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  return obj['isMesh'] === true;
}
