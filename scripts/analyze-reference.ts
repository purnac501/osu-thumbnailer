import sharp from "sharp";

// Pixel analysis of reference/Reference.png (1024x576).
// Prints exact colors and element bounding boxes measured from the image.
const img = sharp("reference/Reference.png");
const { width = 0, height = 0 } = await img.metadata();
const raw = await img.raw().toBuffer();
const px = (x: number, y: number): [number, number, number] => {
  const i = (y * width + x) * 3;
  return [raw[i] ?? 0, raw[i + 1] ?? 0, raw[i + 2] ?? 0];
};
const hex = (c: readonly number[]) =>
  `#${c.map((v) => (v ?? 0).toString(16).padStart(2, "0")).join("")}`;

function bbox(pred: (x: number, y: number) => boolean) {
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pred(x, y)) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return count ? { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, count } : null;
}

const isBlue = (x: number, y: number) => {
  const [r, g, b] = px(x, y);
  return b > 160 && b > r + 50 && b > g + 20 && r < 160;
};
const isGold = (x: number, y: number) => {
  const [r, g, b] = px(x, y);
  return r > 200 && g > 120 && g < 200 && b < 100;
};
const isYellowTile = (x: number, y: number) => {
  const [r, g, b] = px(x, y);
  return r > 200 && g > 140 && b < 110;
};
const isPurpleTile = (x: number, y: number) => {
  const [r, g, b] = px(x, y);
  return b > 200 && r > 80 && r < 160 && g < 120;
};
const isNamePanel = (x: number, y: number) => {
  const [r, g, b] = px(x, y);
  const d = (a: number, t: number) => Math.abs(a - t);
  return d(r, 74) < 26 && d(g, 38) < 26 && d(b, 38) < 26 && x > 500;
};
const isWhiteText = (x: number, y: number) => {
  const [r, g, b] = px(x, y);
  return r > 220 && g > 220 && b > 220;
};

console.log("size:", width, height);
console.log("blue notch bbox (1024):", bbox(isBlue));
console.log("gold FC bbox:", bbox((x, y) => isGold(x, y) && y < 200));
console.log("yellow mod tile bbox:", bbox(isYellowTile));
console.log("purple mod tile bbox:", bbox(isPurpleTile));
console.log("name panel bbox:", bbox(isNamePanel));

// White text rows: map title, accuracy, back-to
console.log("map title rows (x 300-700, y 250-330):", bbox((x, y) => isWhiteText(x, y) && y > 250 && y < 330 && x > 300 && x < 700));
console.log("accuracy bbox (y 330-410, x 200-440):", bbox((x, y) => isWhiteText(x, y) && y > 330 && y < 410 && x < 440));
console.log("back-to bbox (y 480-570):", bbox((x, y) => isWhiteText(x, y) && y > 480 && y < 570));

// Point samples
const samples: [string, number, number][] = [
  ["panel bg (512,160)", 512, 160],
  ["badge border top of DIFF (512,190)", 512, 189],
  ["badge border (512,191)", 512, 191],
  ["badge fill (512,215)", 512, 215],
  ["FC stroke (95,90)", 95, 90],
  ["star text (500,60)", 500, 60],
  ["name panel (700,368)", 700, 368],
  ["name panel (950,350)", 950, 350],
  ["grade S (135,390)", 135, 390],
  ["leaderboard #2 (395,443)", 395, 443],
  ["accent #2 bottom (585,527)", 585, 527],
  ["twitch tile (60,527)", 60, 527],
  ["canvas bg (512,320)", 512, 320],
  ["notch blue (407,20)", 407, 20],
  ["notch blue (407,60)", 407, 60],
];
for (const [name, x, y] of samples) {
  console.log(name, hex(px(x, y)));
}

// Scan name panel vertical extent at x=800
let panelTop = -1, panelBottom = -1;
for (let y = 300; y < 480; y++) {
  if (isNamePanel(800, y)) {
    if (panelTop < 0) panelTop = y;
    panelBottom = y;
  }
}
console.log("name panel rows at x=800:", panelTop, "-", panelBottom);

// Scan panel (top dark panel) bottom edge: find pink border row near x=300
for (let y = 180; y < 260; y++) {
  const [r, g, b] = px(300, y);
  if (r > 140 && r > b + 40 && g < 120) {
    console.log("pink border row at x=300:", y, hex([r, g, b]));
    break;
  }
}

// Panel bbox: dark panel region detection at y=100: find left/right edge
let pLeft = -1, pRight = -1;
for (let x = 0; x < width; x++) {
  const [r, g, b] = px(x, 100);
  const dark = r < 80 && g < 60 && b < 60;
  if (dark && pLeft < 0) pLeft = x;
  if (dark) pRight = x;
}
console.log("panel row100 dark x-range:", pLeft, pRight);

// notch horizontal extent at y=20
let nLeft = -1, nRight = -1;
for (let x = 200; x < 700; x++) {
  if (isBlue(x, 20)) {
    if (nLeft < 0) nLeft = x;
    nRight = x;
  }
}
console.log("notch x-range at y=20:", nLeft, nRight);

// notch bottom tip: lowest blue pixel in notch column range
const notch = bbox((x, y) => isBlue(x, y) && x > 300 && x < 520 && y < 150);
console.log("notch bbox (restricted):", notch);

// mod tiles vertical extent
const yTile = bbox(isYellowTile);
console.log("yellow tile rows:", yTile?.minY, yTile?.maxY, "cols:", yTile?.minX, yTile?.maxX);
const pTile = bbox(isPurpleTile);
console.log("purple tile rows:", pTile?.minY, pTile?.maxY, "cols:", pTile?.minX, pTile?.maxX);
