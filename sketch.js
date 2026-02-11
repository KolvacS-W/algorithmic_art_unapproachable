let sortStepsPerSecond = 20; // Bubble-sort steps per second (adjust this)
let moveEase = 0.2; // Rectangle movement smoothness/speed (0.05 to 0.4)
let sortingAlgorithm = "random"; // "random", "bubble", "selection", "insertion"
let removeGroupSize = 2; // When N consecutive ascending IDs appear, remove them
let noiseSpeedW = 0.01; // Perlin-noise speed for rectangle width
let noiseSpeedH = 0.01; // Perlin-noise speed for rectangle height
let noiseAmplitudeW = 0.01; // Width changes around this +/- ratio from average rectWidth
let noiseAmplitudeH = 0.01; // Height changes around this +/- ratio from average rectHeight
let dotBeatAmount = 0.45; // Dot pulse strength (heartbeat feel)
let glowLineThickness = 1.6; // Main white line thickness
let glowBlurSpread = 24; // Extra blur thickness around the line
let glowBlurLayers = 16; // Number of blur layers
let glowCoreAlpha = 2; // Main line transparency
let glowLayerAlphaMin = 1; // Blur layer min alpha
let glowLayerAlphaMax = 8; // Blur layer max alpha
let mergedDotColor = "#FF3FA4"; // Pink color after full merge
let mergePauseMinMs = 900; // Minimum pause time after merge
let mergePauseMaxMs = 2600; // Maximum pause time after merge
let mergeShakeMaxOffset = 4; // Max shake offset while merged
let mergeShakeBlurLayers = 8; // Blurry halo layers for merged dot
let mergeShakeBlurSpread = 10; // Max blur spread for merged dot
let colorModeOption = "mono"; // "palette" or "mono"
const PALETTE = [
  "#20C4F4", // cyan
  "#FF1D8E", // magenta
  "#FFD11A", // yellow
  "#00A651", // green
  "#3050F8", // blue
  "#0F1020", // deep navy
];

let relationshipStates = {};
let relationshipLayout = null;
let curveSampleCount = 180;

function setup() {
  createCanvas(800, 600);
}

function draw() {
  if (colorModeOption === "mono") {
    background("black");
  } else {
    background("#e6e6e8");
  }
  drawRelationshipBars();
}

// Randomly split the canvas into horizontal bars; split each bar vertically.
// Each cell gets one fitted relationship.
function drawRelationshipBars() {
  if (
    !relationshipLayout ||
    relationshipLayout.canvasW !== width ||
    relationshipLayout.canvasH !== height
  ) {
    relationshipLayout = buildRelationshipBarLayout();
    relationshipStates = {};
  }

  for (let item of relationshipLayout.items) {
    let ay = sampleBoundaryCurve(
      relationshipLayout.centerCurves[item.barIndex],
      relationshipLayout.x0,
      relationshipLayout.x1,
      item.ax,
    );
    let by = sampleBoundaryCurve(
      relationshipLayout.centerCurves[item.barIndex],
      relationshipLayout.x0,
      relationshipLayout.x1,
      item.bx,
    );

    createrelationship(
      item.id,
      item.ax,
      ay,
      item.bx,
      by,
      item.rectWidth,
      item.rectHeight,
      item.numRects,
      item,
    );
  }
}

function buildRelationshipBarLayout() {
  let margin = min(width, height) * 0.04;
  let x0 = margin;
  let x1 = width - margin;
  let y0 = margin;
  let y1 = height - margin;
  let innerW = x1 - x0;
  let innerH = y1 - y0;

  let barCount = floor(random(5, 9));
  let minBarH = max(42, innerH * 0.08);
  let maxBarH = innerH * 0.28;
  let barHeights = randomPartition(innerH, barCount, minBarH, maxBarH);

  // Build non-overlapping smooth curved boundaries for bars.
  let gapProfiles = [];
  for (let b = 0; b < barCount; b++) {
    gapProfiles.push({
      base: barHeights[b],
      a1: random(0.12, 0.33),
      a2: random(0.05, 0.16),
      f1: random(0.8, 1.8),
      f2: random(1.8, 3.7),
      p1: random(TWO_PI),
      p2: random(TWO_PI),
    });
  }

  let minGap = max(26, innerH * 0.04);
  let boundaries = [];
  for (let k = 0; k <= barCount; k++) boundaries.push([]);

  for (let s = 0; s < curveSampleCount; s++) {
    let t = s / (curveSampleCount - 1);
    let gaps = [];
    let totalGaps = 0;
    for (let b = 0; b < barCount; b++) {
      let p = gapProfiles[b];
      let mod =
        1 +
        p.a1 * sin(TWO_PI * p.f1 * t + p.p1) +
        p.a2 * sin(TWO_PI * p.f2 * t + p.p2);
      let g = max(minGap, p.base * mod);
      gaps.push(g);
      totalGaps += g;
    }

    let scale = innerH / totalGaps;
    let yCursor = y0;
    boundaries[0][s] = yCursor;
    for (let b = 0; b < barCount; b++) {
      yCursor += gaps[b] * scale;
      boundaries[b + 1][s] = yCursor;
    }
  }

  let centerCurves = [];
  for (let b = 0; b < barCount; b++) {
    let curve = [];
    for (let s = 0; s < curveSampleCount; s++) {
      curve.push((boundaries[b][s] + boundaries[b + 1][s]) * 0.5);
    }
    centerCurves.push(curve);
  }

  let items = [];
  for (let b = 0; b < barCount; b++) {
    let colCount = floor(random(2, 5));
    let minCellW = max(70, innerW * 0.09);
    let maxCellW = innerW * 0.45;
    let colWidths = randomPartition(innerW, colCount, minCellW, maxCellW);

    let x = x0;
    for (let c = 0; c < colWidths.length; c++) {
      let cellW = colWidths[c];
      let cellX0 = x;
      let cellX1 = x + cellW;
      let edgePad = min(18, cellW * 0.12);
      let ax = cellX0 + edgePad;
      let bx = cellX1 - edgePad;

      if (bx - ax > 24) {
        let barMidX = (ax + bx) * 0.5;
        let topY = sampleBoundaryCurve(boundaries[b], x0, x1, barMidX);
        let bottomY = sampleBoundaryCurve(boundaries[b + 1], x0, x1, barMidX);
        let bandH = max(12, bottomY - topY);
        let rectHeight = constrain(bandH * 0.56, 12, bandH * 0.9);
        let rectWidth = constrain(rectHeight * random(0.14, 0.24), 3, 14);
        let numRects = floor(random(6, 18));

        items.push({
          id: "bar_" + b + "_cell_" + c,
          barIndex: b,
          ax: ax,
          bx: bx,
          rectWidth: rectWidth,
          rectHeight: rectHeight,
          numRects: numRects,
        });
      }
      x += cellW;
    }
  }

  return {
    canvasW: width,
    canvasH: height,
    x0: x0,
    x1: x1,
    boundaries: boundaries,
    centerCurves: centerCurves,
    items: items,
  };
}

function randomPartition(total, count, minSize, maxSize) {
  let sizes = [];
  let remaining = total;
  let remainingParts = count;

  for (let i = 0; i < count - 1; i++) {
    let minAllowed = max(minSize, remaining - maxSize * (remainingParts - 1));
    let maxAllowed = min(maxSize, remaining - minSize * (remainingParts - 1));
    let size = random(minAllowed, maxAllowed);
    sizes.push(size);
    remaining -= size;
    remainingParts--;
  }
  sizes.push(remaining);
  return sizes;
}

function sampleBoundaryCurve(curve, x0, x1, x) {
  let t = constrain((x - x0) / max(1e-6, x1 - x0), 0, 1);
  let idx = t * (curve.length - 1);
  let i0 = floor(idx);
  let i1 = min(curve.length - 1, i0 + 1);
  let f = idx - i0;
  return lerp(curve[i0], curve[i1], f);
}

// Creates and animates one relationship between dot A(ax, ay) and dot B(bx, by).
function createrelationship(
  id,
  ax,
  ay,
  bx,
  by,
  rectWidth = 24,
  rectHeight = 100,
  numRects = 8,
  layoutItem = null,
) {
  let dx = bx - ax;
  let dy = by - ay;
  let w = dist(ax, ay, bx, by);
  let angle = atan2(dy, dx);
  let worldX = (ax + bx) * 0.5;
  let worldY = (ay + by) * 0.5;

  let key = [
    id,
    w,
    rectWidth,
    rectHeight,
    numRects,
    sortingAlgorithm,
    removeGroupSize,
    colorModeOption,
  ].join("_");

  if (!relationshipStates[id] || relationshipStates[id].key !== key) {
    relationshipStates[id] = makeRelationshipState(
      key,
      id,
      w,
      rectWidth,
      rectHeight,
      numRects,
    );
  }

  let state = relationshipStates[id];
  state.worldX = worldX;
  state.worldY = worldY;
  state.angle = angle;
  state.ax = ax;
  state.ay = ay;
  state.bx = bx;
  state.by = by;
  state.layoutItem = layoutItem;

  updateRelationship(state);
  drawRelationship(state);
}

function makeRelationshipState(
  key,
  relationId,
  w,
  rectWidth,
  rectHeight,
  numRects,
) {
  let dotSize = max(8, rectHeight * 0.48); // Dot size is proportional to rectangle height.
  let sidePadding = 24;

  // Local coordinates: relationship center is at x=0, y=0.
  let leftX = -w / 2;
  let rightX = w / 2;

  let innerLeft = leftX + dotSize / 2 + sidePadding;
  let innerRight = rightX - dotSize / 2 - sidePadding;
  let available = innerRight - innerLeft;

  let maxFit = max(1, floor(available / rectWidth));
  let count = constrain(floor(numRects), 1, maxFit);

  let gap = count > 1 ? (available - count * rectWidth) / (count - 1) : 0;
  let usedWidth = count * rectWidth + (count - 1) * gap;
  let startX = -usedWidth / 2;

  let slots = [];
  for (let i = 0; i < count; i++) {
    slots.push(startX + i * (rectWidth + gap));
  }

  // IDs are 1..count. Each ID has a gradient color.
  let dotColorA;
  let dotColorB;
  if (colorModeOption === "mono") {
    dotColorA = color(110);
    dotColorB = color(245);
  } else {
    let pair = palettePairForId(relationId);
    dotColorA = color(PALETTE[pair[0]]);
    dotColorB = color(PALETTE[pair[1]]);
  }
  let rects = [];
  for (let id = 1; id <= count; id++) {
    rects.push({
      id: id,
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
    cx: 0,
    cy: 0,
    worldX: 0,
    worldY: 0,
    angle: 0,
    ax: 0,
    ay: 0,
    bx: 0,
    by: 0,
    layoutItem: null,
    leftX: leftX,
    rightX: rightX,
    targetLeftX: leftX,
    targetRightX: rightX,
    dotSize: dotSize,
    currentDotSize: dotSize,
    dotColorA: dotColorA,
    dotColorB: dotColorB,
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
    mergePauseStarted: false,
    mergePauseStart: 0,
    mergePauseUntil: 0,
    mergeChaos: 0,
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

    // Width noise.
    let nW = noise(rectObj.noiseSeedW, frameCount * noiseSpeedW);
    let nH = noise(rectObj.noiseSeedH, frameCount * noiseSpeedH);
    let ampW = max(0, noiseAmplitudeW);
    let ampH = max(0, noiseAmplitudeH);
    let widthScale = max(0.1, 1 + ampW * (nW * 2 - 1));
    rectObj.w = state.rectWidth * widthScale;

    // Height follows local curve-band thickness, then adds noise.
    let centerLocalX = rectObj.x + state.rectWidth * 0.5;
    let centerPoint = curvePointForLocalX(state, centerLocalX);
    let bandH = bandHeightAtWorldX(state, centerPoint.x);
    let baseH = max(8, bandH * 0.62);
    let heightScale = max(0.1, 1 + ampH * (nH * 2 - 1));
    let targetH = baseH * heightScale;
    rectObj.h = lerp(rectObj.h, targetH, 0.22);
    noiseSum += (nW + nH) * 0.5;
  }

  // Heartbeat-like pulse tied to rectangle noise.
  let avgNoise = state.rects.length > 0 ? noiseSum / state.rects.length : 0.5;
  let beatSpeed = lerp(0.18, 0.34, avgNoise);
  let beatPhase = frameCount * beatSpeed + avgNoise * TWO_PI * 2.0;
  let beatShape = pow(max(0, sin(beatPhase)), 8);
  let targetDotSize = state.dotSize * (1 + dotBeatAmount * beatShape);
  state.currentDotSize = lerp(state.currentDotSize, targetDotSize, 0.25);

  // If all rectangles are gone, merge dots into one, pause, then respawn.
  if (state.rects.length === 0) {
    if (!state.merging) {
      state.merging = true;
      state.targetLeftX = state.cx;
      state.targetRightX = state.cx;
      state.mergePauseStarted = false;
      state.mergePauseStart = 0;
      state.mergePauseUntil = 0;
      state.mergeChaos = 0;
    }

    // Hold a strong, steady merged-dot presence during pause.
    state.currentDotSize = lerp(
      state.currentDotSize,
      state.dotSize * 1.12,
      0.2,
    );

    let mergedDistance = abs(state.rightX - state.leftX);
    if (!state.mergePauseStarted && mergedDistance < 0.8) {
      state.mergePauseStarted = true;
      state.mergePauseStart = millis();
      state.mergePauseUntil =
        millis() + random(mergePauseMinMs, mergePauseMaxMs);
    }

    if (state.mergePauseStarted) {
      let total = max(1, state.mergePauseUntil - state.mergePauseStart);
      let elapsed = millis() - state.mergePauseStart;
      state.mergeChaos = constrain(elapsed / total, 0, 1);
    } else {
      state.mergeChaos = 0;
    }

    // Strong pause as one dot before restarting.
    if (state.mergePauseStarted && millis() >= state.mergePauseUntil) {
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
  // Draw glow line first so it appears behind rectangles and dots.
  drawGlowLine(state);
  noStroke();

  // Dots
  if (state.rects.length === 0) {
    let mergedLocalX = (state.leftX + state.rightX) * 0.5;
    let mergedPoint = curvePointForLocalX(state, mergedLocalX);
    let mergedSize = state.currentDotSize * 1.12;
    let chaos = pow(state.mergeChaos, 1.35);
    let shakeAmp = lerp(0.2, mergeShakeMaxOffset, chaos);
    let shakeFreq = lerp(0.2, 1.6, chaos);
    let jx = sin(frameCount * shakeFreq * 0.73 + state.dotSize) * shakeAmp;
    let jy =
      cos(frameCount * shakeFreq * 0.91 + state.dotSize * 0.37) * shakeAmp;
    let x = mergedPoint.x + jx;
    let y = mergedPoint.y + jy;

    // Blur grows stronger while merged chaos increases.
    noStroke();
    for (let i = mergeShakeBlurLayers; i >= 1; i--) {
      let t = i / mergeShakeBlurLayers;
      let spread = mergeShakeBlurSpread * chaos * t;
      let a = lerp(2, 22, chaos) * t;
      fill(255, 80, 170, a);
      circle(x, y, mergedSize + spread);
    }

    fill(mergedDotColor);
    circle(x, y, mergedSize);
    return;
  }

  let leftPoint = curvePointForLocalX(state, state.leftX);
  let rightPoint = curvePointForLocalX(state, state.rightX);
  fill(state.dotColorA);
  circle(leftPoint.x, leftPoint.y, state.currentDotSize);
  fill(state.dotColorB);
  circle(rightPoint.x, rightPoint.y, state.currentDotSize);

  // Rectangles
  rectMode(CENTER);
  let gradientTById = buildGradientTById(state.rects);
  for (let rectObj of state.rects) {
    let slotCenterLocalX = rectObj.x + state.rectWidth / 2;
    let centerPoint = curvePointForLocalX(state, slotCenterLocalX);
    let tangent = curveTangentAngleAtWorldX(state, centerPoint.x);
    let t = gradientTById[rectObj.id];
    fill(lerpColor(state.dotColorA, state.dotColorB, t));
    push();
    translate(centerPoint.x, centerPoint.y);
    rotate(tangent);
    rect(0, 0, rectObj.w, rectObj.h);
    pop();
  }
}

function drawGlowLine(state) {
  let points = getGlowLinePoints(state);
  if (points.length < 2) return;

  noFill();
  strokeCap(ROUND);
  strokeJoin(ROUND);
  curveTightness(-0.35);

  // Soft blur layers.
  for (let i = glowBlurLayers; i >= 1; i--) {
    let t = i / glowBlurLayers;
    let w = glowLineThickness + glowBlurSpread * pow(t, 1.15);
    let a = lerp(glowLayerAlphaMin, glowLayerAlphaMax, t);
    stroke(255, a);
    strokeWeight(w);
    drawSmoothPolyline(points);
  }

  // Core line.
  stroke(255, glowCoreAlpha);
  strokeWeight(glowLineThickness);
  drawSmoothPolyline(points);
}

function getGlowLinePoints(state) {
  let points = [];
  points.push(curvePointForLocalX(state, state.leftX));

  // Follow the current middle points of rectangles, from left to right.
  let mids = [];
  for (let rectObj of state.rects) {
    let localX = rectObj.x + state.rectWidth / 2;
    let p = curvePointForLocalX(state, localX);
    mids.push({
      x: p.x,
      y: p.y,
    });
  }
  mids.sort((a, b) => a.x - b.x);
  for (let p of mids) points.push(p);

  points.push(curvePointForLocalX(state, state.rightX));
  return points;
}

function drawSmoothPolyline(points) {
  beginShape();
  curveVertex(points[0].x, points[0].y);
  for (let p of points) {
    curveVertex(p.x, p.y);
  }
  let last = points[points.length - 1];
  curveVertex(last.x, last.y);
  endShape();
}

function curvePointForLocalX(state, localX) {
  let denom = state.rightX - state.leftX;
  let t = abs(denom) < 1e-6 ? 0.5 : (localX - state.leftX) / denom;
  t = constrain(t, 0, 1);

  let x = lerp(state.ax, state.bx, t);
  let y = lerp(state.ay, state.by, t);

  if (state.layoutItem && relationshipLayout) {
    let curve = relationshipLayout.centerCurves[state.layoutItem.barIndex];
    y = sampleBoundaryCurve(curve, relationshipLayout.x0, relationshipLayout.x1, x);
  }
  return { x: x, y: y };
}

function bandHeightAtWorldX(state, x) {
  if (!state.layoutItem || !relationshipLayout) return state.rectHeight / 0.62;
  let bar = state.layoutItem.barIndex;
  let top = sampleBoundaryCurve(
    relationshipLayout.boundaries[bar],
    relationshipLayout.x0,
    relationshipLayout.x1,
    x,
  );
  let bottom = sampleBoundaryCurve(
    relationshipLayout.boundaries[bar + 1],
    relationshipLayout.x0,
    relationshipLayout.x1,
    x,
  );
  return max(8, bottom - top);
}

function curveTangentAngleAtWorldX(state, x) {
  if (!state.layoutItem || !relationshipLayout) {
    return atan2(state.by - state.ay, state.bx - state.ax);
  }
  let eps = 2.0;
  let curve = relationshipLayout.centerCurves[state.layoutItem.barIndex];
  let yL = sampleBoundaryCurve(curve, relationshipLayout.x0, relationshipLayout.x1, x - eps);
  let yR = sampleBoundaryCurve(curve, relationshipLayout.x0, relationshipLayout.x1, x + eps);
  return atan2(yR - yL, 2 * eps);
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
  state.targetLeftX = -halfSpan;
  state.targetRightX = halfSpan;

  state.slots = [];
  let startX = -usedWidth / 2;
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
      x: 0, // Reappear from center (local space)
      targetX: 0,
      w: state.rectWidth,
      h: state.rectHeight,
      noiseSeedW: random(1000),
      noiseSeedH: random(1000),
    });
  }

  shuffleArray(rects);
  state.rects = rects;

  let usedWidth = count * state.rectWidth + (count - 1) * state.gap;
  let startX = -usedWidth / 2;
  state.slots = [];
  for (let i = 0; i < count; i++) {
    state.slots.push(startX + i * (state.rectWidth + state.gap));
    state.rects[i].targetX = state.slots[i];
  }

  let halfSpan = usedWidth / 2 + state.sidePadding + state.dotSize / 2;
  state.targetLeftX = -halfSpan;
  state.targetRightX = halfSpan;

  state.activeAlgorithm = resolveSortingAlgorithm(sortingAlgorithm);
  rebuildSortForCurrentOrder(state);
  state.merging = false;
  state.mergePauseStarted = false;
  state.mergePauseStart = 0;
  state.mergePauseUntil = 0;
  state.mergeChaos = 0;
  state.lastStepTime = millis();
}

function resolveSortingAlgorithm(algorithm) {
  if (algorithm !== "random") return algorithm;
  let options = ["bubble", "selection", "insertion"];
  return random(options);
}

function palettePairForId(id) {
  let idx = hashStringToInt(id);
  let pairs = [];
  for (let a = 0; a < PALETTE.length; a++) {
    for (let b = 0; b < PALETTE.length; b++) {
      if (a !== b) pairs.push([a, b]);
    }
  }
  return pairs[idx % pairs.length];
}

function hashStringToInt(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function buildGradientTById(rects) {
  let ids = rects
    .map((r) => r.id)
    .slice()
    .sort((a, b) => a - b);

  let map = {};
  if (ids.length === 1) {
    map[ids[0]] = 0.5;
    return map;
  }

  for (let i = 0; i < ids.length; i++) {
    map[ids[i]] = i / (ids.length - 1);
  }
  return map;
}
