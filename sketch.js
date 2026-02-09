function setup() {
  createCanvas(800, 600);
  noLoop();
}

function draw() {
  background(245);

  // Example:
  // center at (400, 300), distance between dots = 520
  // rectangle width = 32, height = 120, number of rectangles = 8
  createrelationship(400, 300, 520, 10, 40, 30);
}

// Creates two dots with parallel vertical rectangles between them.
// cx, cy: center position of the whole relationship
// w: distance between the two dots
// rectWidth, rectHeight: size of each vertical rectangle
// numRects: number of rectangles between the dots
function createrelationship(
  cx,
  cy,
  w,
  rectWidth = 24,
  rectHeight = 100,
  numRects = 8,
) {
  // Dot size is always proportional to rectangle height.
  let dotSize = max(8, rectHeight * 0.48);
  let sidePadding = 24;

  let leftX = cx - w / 2;
  let rightX = cx + w / 2;

  // Horizontal space where rectangles are allowed (between the two dots)
  let innerLeft = leftX + dotSize / 2 + sidePadding;
  let innerRight = rightX - dotSize / 2 - sidePadding;
  let available = innerRight - innerLeft;

  noStroke();
  fill(105);

  // Left dot
  circle(leftX, cy, dotSize);

  // Right dot
  circle(rightX, cy, dotSize);

  // Draw a row of parallel vertical rectangles centered at cy.
  let maxFit = max(1, floor(available / rectWidth));
  let count = constrain(floor(numRects), 1, maxFit);
  let gap = count > 1 ? (available - count * rectWidth) / (count - 1) : 0;
  let usedWidth = count * rectWidth + (count - 1) * gap;
  let startX = cx - usedWidth / 2;
  let topY = cy - rectHeight / 2;

  for (let i = 0; i < count; i++) {
    let x = startX + i * (rectWidth + gap);
    rect(x, topY, rectWidth, rectHeight);
  }
}
