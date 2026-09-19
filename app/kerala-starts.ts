import type {Point} from './alappuzha-map';
// Approximate town-centre starting points, snapped to a nearby mapped road by the world.
export const KERALA_STARTS: {id:string;town:string;point:Point}[] = [
 {id:'kasaragod',town:'Kasaragod',point:[74.988,12.4996]},
 {id:'kannur',town:'Kannur',point:[75.3704,11.8745]},
 {id:'wayanad',town:'Kalpetta',point:[76.083,11.6103]},
 {id:'kozhikode',town:'Kozhikode',point:[75.7804,11.2588]},
 {id:'malappuram',town:'Malappuram',point:[76.071,11.051]},
 {id:'palakkad',town:'Palakkad',point:[76.6548,10.7867]},
 {id:'thrissur',town:'Thrissur',point:[76.2144,10.5276]},
 {id:'ernakulam',town:'Kochi',point:[76.2999,9.9816]},
 {id:'idukki',town:'Thodupuzha',point:[76.7181,9.8943]},
 {id:'kottayam',town:'Kottayam',point:[76.5222,9.5916]},
 {id:'alappuzha',town:'Alappuzha',point:[76.3388,9.4981]},
 {id:'pathanamthitta',town:'Pathanamthitta',point:[76.787,9.2648]},
 {id:'kollam',town:'Kollam',point:[76.6141,8.8932]},
 {id:'thiruvananthapuram',town:'Thiruvananthapuram',point:[76.9366,8.5241]},
];
