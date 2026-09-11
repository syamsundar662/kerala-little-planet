import * as T from 'three';
import {createKit} from './kerala-props';
import {addSouthernDistricts} from './district-scenery-south';
import {addCentralDistricts} from './district-scenery-central';
import {addNorthernDistricts} from './district-scenery-north';
import type {Obstacle} from './vehicle-physics';
// Assembles all fourteen district set-pieces onto the globe. The three regional
// modules share one prop Kit and run in order so each region sees the obstacles the
// previous ones pushed and never overlaps their footprints.
export function createDistrictScenery(globe:T.Group,obstacles:Obstacle[],latitude:(t:number)=>number){
 const kit=createKit();
 const south=addSouthernDistricts(globe,obstacles,latitude,kit);
 const central=addCentralDistricts(globe,obstacles,latitude,kit);
 const north=addNorthernDistricts(globe,obstacles,latitude,kit);
 return {
  landmarks:south.landmarks+central.landmarks+north.landmarks,
  update(now:number){south.update(now);central.update(now);north.update(now)},
  dispose(){south.dispose();central.dispose();north.dispose();kit.dispose()}
 };
}
