let sortStepsPerSecond = 20; // Bubble-sort steps per second (adjust this)
let moveEase = 0.4; // Rectangle movement smoothness/speed (0.05 to 0.4)

let relationshipState = null;

function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(245);

  // cx, cy, distanceBetweenDots, rectWidth, rectHeight, numRects
  createrelationship(400, 300, 520, 16, 60, 20);
}

// Creates and animates a relationship of two dots and sortable rectangles.
function createrelationship(
  cx,
  cy,
  w,
  rectWidth = 24,
  rectHeight = 100,
  numRects = 8,
) {
  let key = [cx, cy, w, rectWidth, rectHeight, numRects].join("_");

  // Rebuild state when parameters change.
  if (!relationshipState || relationshipState.key !== key) {
    relationshipState = makeRelationshipState(
      key,
      cx,
      cy,
      w,
      rectWidth,
      rectHeight,
      numRects,
    );
  }

  updateRelationship(relationshipState);
  drawRelationship(relationshipState);
}

function makeRelationshipState(
  key,
  cx,
  cy,
  w,
  rectWidth,
  rectHeight,
  numRects,
) {
  let dotSize = max(8, rectHeight * 0.48); // Dot size is proportional to rectangle height.
  let sidePadding = 24;

  let leftX = cx - w / 2;
  let rightX = cx + w / 2;

  let innerLeft = leftX + dotSize / 2 + sidePadding;
  let innerRight = rightX - dotSize / 2 - sidePadding;
  let available = innerRight - innerLeft;

  let maxFit = max(1, floor(available / rectWidth));
  let count = constrain(floor(numRects), 1, maxFit);

  let gap = count > 1 ? (available - count * rectWidth) / (count - 1) : 0;
  let usedWidth = count * rectWidth + (count - 1) * gap;
  let startX = cx - usedWidth / 2;

  let slots = [];
  for (let i = 0; i < count; i++) {
    slots.push(startX + i * (rectWidth + gap));
  }

  // IDs are 1..count. Each ID has a gradient color.
  let rects = [];
  for (let id = 1; id <= count; id++) {
    rects.push({
      id: id,
      color: idToColor(id, count),
      x: 0,
      targetX: 0,
    });
  }

  // Randomly shuffle rectangle sequence.
  shuffleArray(rects);

  // Start each rectangle at its current slot.
  for (let i = 0; i < rects.length; i++) {
    rects[i].x = slots[i];
    rects[i].targetX = slots[i];
  }

  return {
    key: key,
    cx: cx,
    cy: cy,
    leftX: leftX,
    rightX: rightX,
    dotSize: dotSize,
    rectWidth: rectWidth,
    rectHeight: rectHeight,
    slots: slots,
    rects: rects,
    pass: 0,
    index: 0,
    done: false,
    lastStepTime: millis(),
  };
}

function updateRelationship(state) {
  // Keep targets aligned with slot positions.
  for (let i = 0; i < state.rects.length; i++) {
    state.rects[i].targetX = state.slots[i];
  }

  // Animate movement.
  for (let rectObj of state.rects) {
    rectObj.x = lerp(rectObj.x, rectObj.targetX, moveEase);
  }

  if (state.done) return;

  // Wait until rectangles settle before next bubble-sort step.
  if (!allRectsSettled(state.rects)) return;

  // Adjustable sorting speed.
  let stepDelayMs = 1000 / max(0.1, sortStepsPerSecond);
  if (millis() - state.lastStepTime < stepDelayMs) return;
  state.lastStepTime = millis();

  let n = state.rects.length;
  if (state.pass >= n - 1) {
    state.done = true;
    return;
  }

  let j = state.index;

  // Bubble sort comparison and swap.
  if (state.rects[j].id > state.rects[j + 1].id) {
    let temp = state.rects[j];
    state.rects[j] = state.rects[j + 1];
    state.rects[j + 1] = temp;
  }

  state.index++;
  if (state.index >= n - 1 - state.pass) {
    state.index = 0;
    state.pass++;
  }
}

function drawRelationship(state) {
  noStroke();
  fill(105);

  // Dots
  circle(state.leftX, state.cy, state.dotSize);
  circle(state.rightX, state.cy, state.dotSize);

  // Rectangles
  let topY = state.cy - state.rectHeight / 2;
  for (let rectObj of state.rects) {
    fill(rectObj.color);
    rect(rectObj.x, topY, state.rectWidth, state.rectHeight);
  }
}

function idToColor(id, count) {
  // Low id = darker, high id = lighter (gradient).
  let t = count === 1 ? 0 : (id - 1) / (count - 1);
  let shade = lerp(70, 200, t);
  return color(shade);
}

function allRectsSettled(rects) {
  for (let rectObj of rects) {
    if (abs(rectObj.x - rectObj.targetX) > 0.5) {
      return false;
    }
  }
  return true;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    let j = floor(random(i + 1));
    let temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
}
