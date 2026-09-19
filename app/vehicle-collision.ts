export type VehicleBody = { x: number; z: number; yaw: number; length: number; width: number };
export function vehicleOverlap(a: VehicleBody, b: VehicleBody) {
  const sa = Math.sin(a.yaw), ca = Math.cos(a.yaw), sb = Math.sin(b.yaw), cb = Math.cos(b.yaw);
  const dx = a.x - b.x, dz = a.z - b.z;
  return [[sa, ca], [ca, -sa], [sb, cb], [cb, -sb]].every(([x,z]) =>
    Math.abs(dx*x + dz*z) < a.length*Math.abs(sa*x+ca*z) + a.width*Math.abs(ca*x-sa*z) +
      b.length*Math.abs(sb*x+cb*z) + b.width*Math.abs(cb*x-sb*z) + .15);
}
// Sweep small steps so fast vehicles cannot jump through a narrow bike or bus.
export function sweepVehicle(from: VehicleBody, to: VehicleBody, obstacles: VehicleBody[]) {
  const angle = Math.atan2(Math.sin(to.yaw-from.yaw), Math.cos(to.yaw-from.yaw));
  const steps = Math.max(1, Math.ceil((Math.hypot(to.x-from.x,to.z-from.z) + Math.abs(angle)*from.length)/.2));
  let safe = from;
  for (let i=1;i<=steps;i++) {
    const t=i/steps;
    const next = {...from,x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t,yaw:from.yaw+angle*t};
    for (const other of obstacles) {
      if (!vehicleOverlap(next,other)) continue;
      // A peer can join on our spawn. Let an already overlapping player back out.
      if (vehicleOverlap(from,other) &&
          Math.hypot(next.x-other.x,next.z-other.z) > Math.hypot(from.x-other.x,from.z-other.z) + .00001) continue;
      return {body:safe,hit:true};
    }
    safe=next;
  }
  return {body:safe,hit:false};
}
