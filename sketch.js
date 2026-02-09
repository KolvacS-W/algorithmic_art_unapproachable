let sortStepsPerSecond = 80; // Bubble-sort steps per second (adjust this)
let moveEase = 0.2; // Rectangle movement smoothness/speed (0.05 to 0.4)
let sortingAlgorithm = "random"; // "random", "bubble", "selection", "insertion"
let removeGroupSize = 3; // When N consecutive ascending IDs appear, remove them
let noiseSpeed = 0.06; // Speed of Perlin-noise size changes
let noiseAmplitude = 0.8; // Size changes around +/-40% from average width/height
let dotBeatAmount = 0.45; // Dot pulse strength (heartbeat feel)

let relationshipState = null;

function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(245);

  // cx, cy, distanceBetweenDots, rectWidth, rectHeight, numRects
  createrelationship(400, 300, 520, 12, 60, 30);
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
  let key = [
    cx,
    cy,
    w,
    rectWidth,
    rectHeight,
    numRects,
    sortingAlgorithm,
    removeGroupSize,
  ].join("_");

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
      w: rectWidth,
      h: rectHeight,
      noiseSeedW: random(1000),
      noiseSeedH: random(1000),
    });
  }

  // Randomly shuffle rectangle sequence.
  shuffleArray(rects);

  // Build swap sequence using the chosen sorting algorithm.
  let activeAlgorithm = resolveSortingAlgorithm(sortingAlgorithm);
  let startIds = rects.map((r) => r.id);
  let swapPlan = buildSwapPlan(startIds, activeAlgorithm);

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
    targetLeftX: leftX,
    targetRightX: rightX,
    dotSize: dotSize,
    currentDotSize: dotSize,
    sidePadding: sidePadding,
    gap: gap,
    baseCount: count,
    rectWidth: rectWidth,
    rectHeight: rectHeight,
    slots: slots,
    rects: rects,
    swapPlan: swapPlan,
    swapIndex: 0,
    activeAlgorithm: activeAlgorithm,
    done: false,
    merging: false,
    mergeStartDistance: 0,
    lastStepTime: millis(),
  };
}

function updateRelationship(state) {
  // Keep targets aligned with slot positions.
  for (let i = 0; i < state.rects.length; i++) {
    state.rects[i].targetX = state.slots[i];
  }

  let noiseSum = 0;

  // Animate movement for dots and rectangles.
  state.leftX = lerp(state.leftX, state.targetLeftX, moveEase);
  state.rightX = lerp(state.rightX, state.targetRightX, moveEase);
  for (let rectObj of state.rects) {
    rectObj.x = lerp(rectObj.x, rectObj.targetX, moveEase);

    // Dynamic size using Perlin noise.
    // rectWidth/rectHeight stay the average values.
    let nW = noise(rectObj.noiseSeedW, frameCount * noiseSpeed);
    let nH = noise(rectObj.noiseSeedH, frameCount * noiseSpeed);
    let amp = max(0, noiseAmplitude);
    let widthScale = max(0.1, 1 + amp * (nW * 2 - 1));
    let heightScale = max(0.1, 1 + amp * (nH * 2 - 1));
    rectObj.w = state.rectWidth * widthScale;
    rectObj.h = state.rectHeight * heightScale;
    noiseSum += (nW + nH) * 0.5;
  }

  // Heartbeat-like pulse tied to rectangle noise.
  let avgNoise = state.rects.length > 0 ? noiseSum / state.rects.length : 0.5;
  let beatSpeed = lerp(0.18, 0.34, avgNoise);
  let beatPhase = frameCount * beatSpeed + avgNoise * TWO_PI * 2.0;
  let beatShape = pow(max(0, sin(beatPhase)), 8);
  let targetDotSize = state.dotSize * (1 + dotBeatAmount * beatShape);
  state.currentDotSize = lerp(state.currentDotSize, targetDotSize, 0.25);

  // If all rectangles are gone, move dots toward merging, then respawn before full merge.
  if (state.rects.length === 0) {
    if (!state.merging) {
      state.merging = true;
      state.mergeStartDistance = abs(state.rightX - state.leftX);
      state.targetLeftX = state.cx;
      state.targetRightX = state.cx;
    }

    let currentDistance = abs(state.rightX - state.leftX);
    let respawnDistance = state.mergeStartDistance * 0.45;

    // Respawn before the dots fully merge.
    if (currentDistance <= respawnDistance) {
      respawnRectangles(state);
    }
    return;
  }

  // Wait until everything settles before update/removal/sort step.
  if (!allSettled(state)) return;

  // Remove the first group of N ascending IDs, then relayout and rebuild sort.
  if (tryRemoveAscendingGroup(state)) {
    state.lastStepTime = millis();
    return;
  }

  if (state.done) return;

  // Adjustable sorting speed.
  let stepDelayMs = 1000 / max(0.1, sortStepsPerSecond);
  if (millis() - state.lastStepTime < stepDelayMs) return;
  state.lastStepTime = millis();

  if (state.swapIndex >= state.swapPlan.length) {
    state.done = true;
    return;
  }

  // Apply one swap from the precomputed plan.
  let pair = state.swapPlan[state.swapIndex];
  let a = pair[0];
  let b = pair[1];
  let temp = state.rects[a];
  state.rects[a] = state.rects[b];
  state.rects[b] = temp;
  state.swapIndex++;
}

function drawRelationship(state) {
  noStroke();
  fill(105);

  // Dots
  circle(state.leftX, state.cy, state.currentDotSize);
  circle(state.rightX, state.cy, state.currentDotSize);

  // Rectangles
  rectMode(CORNER);
  for (let rectObj of state.rects) {
    fill(rectObj.color);
    // Keep each dynamic rectangle centered on its slot center.
    let slotCenterX = rectObj.x + state.rectWidth / 2;
    let drawX = slotCenterX - rectObj.w / 2;
    let drawY = state.cy - rectObj.h / 2;
    rect(drawX, drawY, rectObj.w, rectObj.h);
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

function allSettled(state) {
  if (abs(state.leftX - state.targetLeftX) > 0.5) return false;
  if (abs(state.rightX - state.targetRightX) > 0.5) return false;
  return allRectsSettled(state.rects);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    let j = floor(random(i + 1));
    let temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
}

function buildSwapPlan(ids, algorithm) {
  let arr = ids.slice();
  let swaps = [];

  if (algorithm === "selection") {
    // Selection sort: typically one swap per pass.
    for (let i = 0; i < arr.length - 1; i++) {
      let minIndex = i;
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[j] < arr[minIndex]) {
          minIndex = j;
        }
      }
      if (minIndex !== i) {
        swaps.push([i, minIndex]);
        let temp = arr[i];
        arr[i] = arr[minIndex];
        arr[minIndex] = temp;
      }
    }
    return swaps;
  }

  if (algorithm === "insertion") {
    // Insertion sort: move each value left via adjacent swaps.
    for (let i = 1; i < arr.length; i++) {
      let j = i;
      while (j > 0 && arr[j - 1] > arr[j]) {
        swaps.push([j - 1, j]);
        let temp = arr[j - 1];
        arr[j - 1] = arr[j];
        arr[j] = temp;
        j--;
      }
    }
    return swaps;
  }

  // Default: bubble sort.
  for (let pass = 0; pass < arr.length - 1; pass++) {
    for (let i = 0; i < arr.length - 1 - pass; i++) {
      if (arr[i] > arr[i + 1]) {
        swaps.push([i, i + 1]);
        let temp = arr[i];
        arr[i] = arr[i + 1];
        arr[i + 1] = temp;
      }
    }
  }
  return swaps;
}

function tryRemoveAscendingGroup(state) {
  let n = max(1, floor(removeGroupSize));
  if (state.rects.length === 0) return false;

  let removedSomething = false;

  // If fewer than N rectangles remain, remove all of them when they are ordered.
  if (state.rects.length < n) {
    if (isAscendingConsecutive(state.rects)) {
      state.rects.splice(0, state.rects.length);
      removedSomething = true;
    }
  } else {
    // Remove any existing run of N consecutive ascending IDs.
    // Keep scanning until no such run remains.
    let start = findAscendingRunStart(state.rects, n);
    while (start >= 0) {
      state.rects.splice(start, n);
      removedSomething = true;
      start = findAscendingRunStart(state.rects, n);
    }
  }

  if (!removedSomething) return false;
  relayoutRelationship(state);
  rebuildSortForCurrentOrder(state);
  return true;
}

function findAscendingRunStart(rects, n) {
  let nextMap = buildNextRemainingIdMap(rects);
  for (let i = 0; i <= rects.length - n; i++) {
    let ok = true;
    for (let k = 1; k < n; k++) {
      let prevId = rects[i + k - 1].id;
      let currId = rects[i + k].id;
      if (nextMap[prevId] !== currId) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

function isAscendingConsecutive(rects) {
  if (rects.length <= 1) return rects.length === 1;
  let nextMap = buildNextRemainingIdMap(rects);
  for (let i = 1; i < rects.length; i++) {
    if (nextMap[rects[i - 1].id] !== rects[i].id) {
      return false;
    }
  }
  return true;
}

function buildNextRemainingIdMap(rects) {
  let ids = rects
    .map((r) => r.id)
    .slice()
    .sort((a, b) => a - b);
  let nextMap = {};
  for (let i = 0; i < ids.length - 1; i++) {
    nextMap[ids[i]] = ids[i + 1];
  }
  return nextMap;
}

function relayoutRelationship(state) {
  let count = state.rects.length;
  let usedWidth = 0;
  if (count > 0) {
    usedWidth = count * state.rectWidth + (count - 1) * state.gap;
  }

  let halfSpan = usedWidth / 2 + state.sidePadding + state.dotSize / 2;
  state.targetLeftX = state.cx - halfSpan;
  state.targetRightX = state.cx + halfSpan;

  state.slots = [];
  let startX = state.cx - usedWidth / 2;
  for (let i = 0; i < count; i++) {
    state.slots.push(startX + i * (state.rectWidth + state.gap));
    state.rects[i].targetX = state.slots[i];
  }
}

function rebuildSortForCurrentOrder(state) {
  let ids = state.rects.map((r) => r.id);
  state.swapPlan = buildSwapPlan(ids, state.activeAlgorithm);
  state.swapIndex = 0;
  state.done = state.swapPlan.length === 0;
}

function respawnRectangles(state) {
  let count = state.baseCount;
  let rects = [];

  for (let id = 1; id <= count; id++) {
    rects.push({
      id: id,
      color: idToColor(id, count),
      x: state.cx, // Reappear from center
      targetX: state.cx,
      w: state.rectWidth,
      h: state.rectHeight,
      noiseSeedW: random(1000),
      noiseSeedH: random(1000),
    });
  }

  shuffleArray(rects);
  state.rects = rects;

  let usedWidth = count * state.rectWidth + (count - 1) * state.gap;
  let startX = state.cx - usedWidth / 2;
  state.slots = [];
  for (let i = 0; i < count; i++) {
    state.slots.push(startX + i * (state.rectWidth + state.gap));
    state.rects[i].targetX = state.slots[i];
  }

  let halfSpan = usedWidth / 2 + state.sidePadding + state.dotSize / 2;
  state.targetLeftX = state.cx - halfSpan;
  state.targetRightX = state.cx + halfSpan;

  state.activeAlgorithm = resolveSortingAlgorithm(sortingAlgorithm);
  rebuildSortForCurrentOrder(state);
  state.merging = false;
  state.lastStepTime = millis();
}

function resolveSortingAlgorithm(algorithm) {
  if (algorithm !== "random") return algorithm;
  let options = ["bubble", "selection", "insertion"];
  return random(options);
}
