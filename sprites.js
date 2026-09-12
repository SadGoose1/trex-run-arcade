// Sprite art: char = palette index (0=transparent,1=black,2=white,3=red,5=orange,
// 6=yellow,7=green,b=pale yellow,c=dark gray,d=gray,e=light gray)
// '.' means transparent.

function subst(rows, from, to) {
  return rows.map((r) => r.split(from).join(to));
}

// Chrome-style T-rex facing right: head with mouth slit, tiny arm, tail,
// light belly. Body rows 0-13 + 2 leg rows appended per pose.
const DINO_BODY = [
  "................",
  ".........dddddd.",
  "........dddddddd",
  "........d2dddddd",
  "........dddddddd",
  "........dddccccc",
  "........dddddd..",
  ".d......dddd....",
  ".dd....dddddd...",
  "..dd.ddddddddd..",
  "...dddddddddddd.",
  "...ddddddddddd..",
  "....ddddddddeed.",
  ".....dddddddde..",
];

const dino1 = DINO_BODY.concat(["....ddd...dd....", "....dd.....dd..."]);
const dino2 = DINO_BODY.concat([".....dd..ddd....", ".....dd.....dd.."]);
const dinoJump = DINO_BODY.concat(["....dddddddd....", "................"]);

const dinoDuck = [
  "..........dddd..",
  ".........dddddd.",
  "........d2ddddd.",
  ".d.......dddddd.",
  ".dd....dddddddd.",
  "..ddddddddddddee",
  "...ddddddddddde.",
  "....dddddddddd..",
  ".....dd...dd....",
];

const star1 = subst(dino1, "d", "6");
const star2 = subst(dino2, "d", "6");

// Cacti with a light stripe on the left of the stalk.
const cactus1 = [
  "...76...",
  "...76...",
  "...76...",
  "7..76..7",
  "7..76..7",
  "77.76..7",
  "77.76.77",
  ".777677.",
  "...76...",
  "...76...",
  "...76...",
  "...76...",
  "...76...",
  "...76...",
  "...76...",
  "...76...",
];

const cactus2 = [
  ".....76.....",
  "....776.....",
  "....776..7..",
  "7...776.76..",
  "77..776.76..",
  "77..776.76..",
  "777.776.76..",
  ".777776776..",
  "..7777776...",
  "....77776...",
  "....7776....",
  "....7776....",
  "....7776....",
  "....7776....",
  "...77776....",
  "..777776....",
];

// Bird flying left: yellow beak, white eye, two wing poses.
const birdWingUp = [
  "................",
  "................",
  "................",
  "................",
  ".........555....",
  "........55555...",
  ".......555555...",
  "......55555555..",
  ".55555555555555.",
  "6255555555555555",
  ".55555555555555.",
  "....5555555.....",
  "................",
  "................",
  "................",
  "................",
];

const birdWingDown = [
  "................",
  "................",
  "................",
  "................",
  "................",
  ".........5555...",
  "........555555..",
  "......55555555..",
  ".55555555555555.",
  "6255555555555555",
  ".55555555555555.",
  ".....5555555....",
  "......55555.....",
  ".......555......",
  "................",
  "................",
];

const starPow = [
  "...6....",
  "...6....",
  ".66666..",
  "..666...",
  "..666...",
  ".6.6.6..",
  "........",
  "........",
];

const heart = [
  ".33.33..",
  "3333333.",
  "3333333.",
  "3333333.",
  ".33333..",
  "..333...",
  "...3....",
  "........",
];

const bolt = [
  "....66..",
  "...66...",
  "..66....",
  ".66666..",
  "...66...",
  "..66....",
  ".66.....",
  "........",
];

// Fluffy cloud with a light-gray shaded underside.
const cloud = [
  "........2222............",
  ".....222222222..........",
  "...222222222222...2222..",
  "..222222222222222222222.",
  ".2222222222222222222222.",
  "222222222222222222222222",
  ".222222222222222222222..",
  "..2ee2222222eeee22222...",
  "....eeee2222eeee........",
];

// Full moon with craters.
const moon = [
  "...bbbbbb...",
  ".bbbbbbbbbb.",
  "bbbbbbbbbbbb",
  "bbbccbbbbbbb",
  "bbbbbcbbbbbb",
  "bbbbbbbbccbb",
  "bbbbbbbbccbb",
  "bbbbbbbbbbbb",
  "bbbbccbbbbbb",
  ".bbbbbbbbbb.",
  ".bbbbbbbbbb.",
  "...bbbbbb...",
];

// Cartoon sun: yellow core, orange rays (N/S/E/W + diagonals).
const sun = [
  ".....55.....",
  "..5.6666.5..",
  "....6666....",
  "5..666666..5",
  "556666666655",
  "556666666655",
  "556666666655",
  "556666666655",
  "5..666666..5",
  "....6666....",
  "..5.6666.5..",
  ".....55.....",
];

const ground = ["dddddddddddddddd", "cccccccccccccccc"].map((r) => r.repeat(10));


// Dead dino: laid out flat on its back, feet up, eye open. Art in rows 9-15 so
// at setPos y=100 the body rests on the ground line.
const dinoDead = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "...........dd.dd",
  "...........dd.dd",
  ".d.........ddddd",
  ".dd...dddddddddd",
  "..dddddddd2ddddd",
  "..dddddddddddddd",
  ".dddddddddddddd.",
];

// Tree: 16x36, two-tone foliage with light dapples, sturdy trunk. Requires a
// held (higher) jump to clear.
const tree = [
  "................",
  ".....777767.....",
  "...777677777....",
  "..77777776777...",
  ".7776777777776..",
  ".7777777677777..",
  "777777777776777.",
  "776777777777777.",
  "77777776777777..",
  ".7777777777677..",
  ".7776777777777..",
  "..77777767777...",
  "...7777777776...",
  "....77677777....",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
  "......7777......",
];

module.exports = { dino1, dino2, dinoJump, dinoDuck, dinoDead, star1, star2, cactus1, cactus2, birdWingUp, birdWingDown, tree, starPow, heart, bolt, cloud, moon, sun, ground };
