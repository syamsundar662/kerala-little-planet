// Hex colors are sRGB; THREE.Color converts them to the linear render space.
// Texture tints are deliberately muted so photographed surface detail survives.
export const NATURAL_PALETTE={
 groundTint:0xc4d5b8,mountainTint:0xa8bea0,
 grass:[0x3c6336,0x507c3e,0x638b47,0x719850,0x436f3c],
 shrubs:[0x304d2e,0x405e35,0x55703c,0x637e46],
 plaster:[0xe3decd,0xd7cfbb,0xcebea5,0xe7e0d0,0xc5b9a1],
 roofTint:0xdfd0c0,stoneTint:0xb6afa0,wood:0x514133,
 asphaltTint:0x686b6b,soil:0x8d7155,water:0x385e56,
} as const;
