import {MathUtils, SpotLight} from 'three';

export function installWalkingFlashlight(scene) {
  // A single photometric cone gives the beam a bright center and a soft edge.
  // Keep the light in the scene with zero output when off to reuse the same
  // material shaders as the visitor switches it on and off.
  const beam = new SpotLight(0xfff3da, 0, 20, MathUtils.degToRad(29), .78, 2);
  beam.name = 'Handheld flashlight';
  scene.add(beam, beam.target);

  return {
    update(camera, walking, outdoors, enabled) {
      if (!walking || !enabled) {
        beam.intensity = 0;
        return;
      }

      // Hold the lamp just below the eye. A slight downward aim catches the
      // pavement while looking straight ahead and follows the gaze on stairs.
      camera.updateWorldMatrix(true, false);
      beam.position.set(.105, -.17, -.06).applyMatrix4(camera.matrixWorld);
      beam.target.position.set(0, -1.50, -8).applyMatrix4(camera.matrixWorld);
      beam.distance = outdoors ? 20 : 9;
      beam.intensity = outdoors ? 185 : 32;
    }
  };
}
