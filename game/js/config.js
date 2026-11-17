// NEON HARBOR — all tuning in one place. Change numbers here, never in code.
// Units are metres; speeds are m/s; times are seconds.
export const CFG = {
  seed: 1337,
  // City layout: a grid of square blocks separated by streets.
  blockSize: 42,
  roadWidth: 13,
  blocksX: 7,
  blocksZ: 7,
  // Player on foot.
  walkSpeed: 5.2,
  runSpeed: 8.6,
  jumpSpeed: 7.5,
  gravity: 22,
  playerRadius: 0.55,
  punchRange: 2.4,
  punchDamage: 34,
  punchCooldown: 0.45,
  // Cars (arcade physics).
  carAccel: 16,
  carBrake: 30,
  carReverse: 9,
  carMaxSpeed: 34,
  carMaxReverse: 10,
  carTurn: 1.9,
  carGrip: 6.5,
  handbrakeGrip: 2.2,
  // Wanted system.
  wantedDecayDelay: 18,
  wantedDecayRate: 0.25,
  maxWanted: 5,
  bustedHoldTime: 1.4,
  // Police.
  copFootSpeed: 7.4,
  copCarSpeed: 30,
  maxFootCops: 4,
  maxPoliceCars: 3,
  // Traffic and pedestrians.
  trafficCars: 14,
  trafficSpeed: 9,
  pedestrians: 24,
  pedSpeed: 1.6,
  pedFleeSpeed: 4.2,
  // Missions and economy.
  missionReward: [150, 300, 500],
  pickupValue: 25,
  pickupCount: 10,
  bustedFine: 50,
  // Feel.
  shakeDecay: 1.6,
  hitStopPunch: 0.06,
  hitStopCrash: 0.12,
  // Camera.
  camFollowRate: 8,
  camFootDist: 7.5,
  camCarDist: 11,
  camHeight: 3.4,
  // World.
  missionTimeLimit: 150,
  startCash: 0,
  playerHealth: 100,
};

export const DISTRICTS = {
  downtown: { z: [-3, -1], minH: 26, maxH: 64, tint: 0x8fa3c7 },
  plaza: { z: [0, 0], minH: 8, maxH: 14, tint: 0xc7a58f },
  marina: { z: [1, 2], minH: 10, maxH: 22, tint: 0x8fc7b0 },
  harbor: { z: [3, 3], minH: 6, maxH: 12, tint: 0xc78f8f },
};

export const MISSION_NAMES = [
  'Harbor Pickup',
  'Hot Wheels',
  'Spire Run',
];

export const MISSION_BRIEFS = [
  'Collect the package at the docks, then deliver it to the pawn shop.',
  'Steal the sports car at the marina and deliver it to the garage. The cops will notice.',
  'Hit all 5 checkpoints around the city before the clock runs out.',
];
