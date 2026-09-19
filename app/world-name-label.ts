import * as T from 'three';
import {makeNameLabel} from './player-avatar';
import type {VehicleKind} from './road-vehicles';

export function createWorldNameLabel(scene: T.Scene, name: string) {
  const {sprite,texture}=makeNameLabel(name);
  sprite.name='Player name: '+name;
  sprite.scale.set(2.9,.725,1);
  sprite.material.fog=false;
  scene.add(sprite);
  return {
    update(position:T.Vector3, vehicle:VehicleKind|null) {
      sprite.position.copy(position);
      sprite.position.y += vehicle ? {bus:4.6,lorry:4.4,car:2.6,bike:2.7}[vehicle] : 2.4;
    },
    setVisible(visible:boolean) {sprite.visible=visible;},
    dispose() {sprite.removeFromParent();sprite.material.dispose();texture.dispose();},
  };
}
