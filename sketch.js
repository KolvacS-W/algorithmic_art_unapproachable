// Sorting speed in steps per second.
let sortStepsPerSecond = 10;

// Position easing for dots/rectangles.
let moveEase = 0.1;

// Sorting algorithm: "random", "bubble", "selection", "insertion".
let sortingAlgorithm = "random";

// Group size used by "group" removal mode.
let removeGroupSize = 2;

// Removal mode: "group" (run removal) or "correct_position" (index-correct removal).
let removeMode = "correct_position";

// Noise controls kept only as commented reference.
// let noiseSpeedW = 0.01;
// let noiseSpeedH = 0.01;
// let noiseAmplitudeW = 0.01;
// let noiseAmplitudeH = 0.01;

// Dot heartbeat strength.
let dotBeatAmount = 0.45;

// Merge/split style.
let mergedDotColor = "#FF3FA4";
let mergePauseMinMs = 900;
let mergePauseMaxMs = 2600;
let mergeShakeMaxOffset = 4;
let mergePinkOnlyThreshold = 0.82;

// Mono-only color setup.
let dotColorDark = 110;
let dotColorLight = 245;

// Number of x-samples used to build smooth bar curves.
let curveSampleCount = 180;

// Debug overlay switch: set true to visualize layout construction.
let debugMode = true;

// Draw every Nth curve sample as a dot in debug mode.
let debugSampleStride = 8;

// Runtime state.
let relationshipLayout = null;
let relationshipStates = {};

function setup() {
  // Create canvas.
  createCanvas(800, 600);
}

function draw() {
  // Mono mode background.
  background("black");

  // Build (or rebuild) cached curved layout if canvas changed.
  ensureLayout();

  // Draw static debug guides first (box, boundaries, center curves).
  if (debugMode) {
    drawDebugLayout(relationshipLayout);
  }

  // For each cell, sample the two endpoint y-values from that bar's center curve.
  for (let item of relationshipLayout.items) {
    // Left endpoint y on center curve.
    let ay = sampleCurveAtX(
      relationshipLayout.centerCurves[item.barIndex],
      relationshipLayout.x0,
      relationshipLayout.x1,
      item.ax,
    );
    // Right endpoint y on center curve.
    let by = sampleCurveAtX(
      relationshipLayout.centerCurves[item.barIndex],
      relationshipLayout.x0,
      relationshipLayout.x1,
      item.bx,
    );

    // Run animation update + drawing for this one relationship.
    updateAndDrawRelationship(item, ay, by);

    // Draw anchor/debug points for this specific relationship.
    if (debugMode) {
      drawDebugRelationshipAnchors(item, ay, by);
    }
  }
  // noloop();
}

function ensureLayout() {
  // Rebuild layout when missing or when the canvas size changes.
  if (
    !relationshipLayout ||
    relationshipLayout.canvasW !== width ||
    relationshipLayout.canvasH !== height
  ) {
    relationshipLayout = buildCurvedBarLayout();
    relationshipStates = {};
  }
}

function buildCurvedBarLayout() {
  // 1) Use the full canvas as the layout box.
  let x0 = 0;
  let x1 = width;
  let y0 = 0;
  let y1 = height;
  let spanW = x1 - x0;
  let spanH = y1 - y0;

  // 2) Decide how many curved bars and their base heights.
  let barCount = floor(random(5, 9));
  let minBarH = max(42, spanH * 0.08);
  let maxBarH = spanH * 0.28;
  let barBaseHeights = randomPartition(spanH, barCount, minBarH, maxBarH);

  // 3) Create smooth wave profiles (one profile per bar).
  let profiles = buildBarProfiles(barBaseHeights);

  // 4) Convert profiles into non-overlapping top/bottom boundary curves.
  let minGap = max(26, spanH * 0.04);
  let boundaries = buildBoundariesFromProfiles(profiles, y0, spanH, minGap);

  // 5) Build center curves between each top/bottom boundary pair.
  let centerCurves = buildCenterCurves(boundaries);

  // 6) Split each curved bar into vertical cells and create relationship items.
  let items = buildRelationshipItems(barCount, x0, x1, spanW, boundaries);

  // Return all layout information.
  return {
    canvasW: width,
    canvasH: height,
    x0: x0,
    x1: x1,
    y0: y0,
    y1: y1,
    boundaries: boundaries,
    centerCurves: centerCurves,
    items: items,
  };
}

function drawDebugLayout(layout) {
  if (!layout) return;

  // Label style for debug text.
  textSize(10);
  textAlign(LEFT, TOP);

  // 1) Fill each bar region between boundary[b] and boundary[b + 1].
  for (let b = 0; b < layout.boundaries.length - 1; b++) {
    let col = debugColorForIndex(b + 100, 34);
    noStroke();
    fill(col);
    beginShape();
    for (let s = 0; s < curveSampleCount; s++) {
      let t = s / (curveSampleCount - 1);
      let x = lerp(layout.x0, layout.x1, t);
      let yTop = layout.boundaries[b][s];
      vertex(x, yTop);
    }
    for (let s = curveSampleCount - 1; s >= 0; s--) {
      let t = s / (curveSampleCount - 1);
      let x = lerp(layout.x0, layout.x1, t);
      let yBottom = layout.boundaries[b + 1][s];
      vertex(x, yBottom);
    }
    endShape(CLOSE);
  }

  // 2) Full canvas layout bounds.
  noFill();
  stroke(255, 140, 0);
  strokeWeight(1.2);
  rectMode(CORNERS);
  rect(layout.x0, layout.y0, layout.x1, layout.y1);

  // 3) x0/x1 and y0/y1 guide lines.
  stroke(255, 70, 70);
  line(layout.x0, layout.y0, layout.x0, layout.y1);
  stroke(70, 200, 255);
  line(layout.x1, layout.y0, layout.x1, layout.y1);
  stroke(255, 220, 90);
  line(layout.x0, layout.y0, layout.x1, layout.y0);
  stroke(150, 255, 150);
  line(layout.x0, layout.y1, layout.x1, layout.y1);

  // 4) Top/bottom boundaries for each curved bar area.
  for (let i = 0; i < layout.boundaries.length; i++) {
    let col = debugColorForIndex(i, 200);
    drawDebugCurve(layout.boundaries[i], layout.x0, layout.x1, col, 1.4);
  }

  // 5) Center curve of each bar (where relationships are anchored).
  for (let i = 0; i < layout.centerCurves.length; i++) {
    let col = debugColorForIndex(i + 20, 255);
    drawDebugCurve(layout.centerCurves[i], layout.x0, layout.x1, col, 2.0);
  }

  // 6) Labels for x0/x1/y0/y1 and each bar index b.
  noStroke();
  fill(255, 140, 0);
  text("layout bounds = canvas", layout.x0 + 4, layout.y0 + 4);
  fill(255, 70, 70);
  text("x0", layout.x0 + 3, layout.y0 + 12);
  fill(70, 200, 255);
  text("x1", layout.x1 + 3, layout.y0 + 12);
  fill(255, 220, 90);
  text("y0", layout.x0 + 16, layout.y0 + 2);
  fill(150, 255, 150);
  text("y1", layout.x0 + 16, layout.y1 - 12);

  // Place "b0, b1, ..." near left edge on each bar center curve.
  textAlign(LEFT, CENTER);
  for (let b = 0; b < layout.centerCurves.length; b++) {
    let y = layout.centerCurves[b][0];
    fill(debugColorForIndex(b + 20, 255));
    text(`b${b}`, layout.x0 + 6, y);
  }
}

function drawDebugCurve(curve, x0, x1, col, weight) {
  if (!curve || curve.length < 2) return;

  // Draw the polyline that approximates one sampled curve.
  noFill();
  stroke(col);
  strokeWeight(weight);
  beginShape();
  for (let s = 0; s < curve.length; s++) {
    let t = s / (curve.length - 1);
    let x = lerp(x0, x1, t);
    let y = curve[s];
    vertex(x, y);
  }
  endShape();

  // Draw sparse sample dots to show discrete sample points.
  noStroke();
  fill(red(col), green(col), blue(col), 120);
  for (let s = 0; s < curve.length; s += max(1, debugSampleStride)) {
    let t = s / (curve.length - 1);
    let x = lerp(x0, x1, t);
    let y = curve[s];
    circle(x, y, 2.5);
  }
}

function drawDebugRelationshipAnchors(item, ay, by) {
  // Distinct color per relationship bar.
  let col = debugColorForIndex(item.barIndex + 50, 220);

  // Show sampled anchor line segment for this relationship.
  stroke(col);
  strokeWeight(1.3);
  line(item.ax, ay, item.bx, by);

  // Show actual sampled anchor points.
  noStroke();
  fill(255, 70, 70);
  circle(item.ax, ay, 6);
  fill(70, 200, 255);
  circle(item.bx, by, 6);

  // Coordinate text removed to keep debug view cleaner.
}

function debugColorForIndex(index, alphaValue) {
  // Cycle across a fixed list of high-contrast debug colors.
  let debugColors = [
    [255, 90, 90],
    [90, 220, 255],
    [255, 210, 80],
    [150, 255, 150],
    [255, 120, 230],
    [130, 150, 255],
    [255, 170, 90],
  ];
  let c = debugColors[index % debugColors.length];
  return color(c[0], c[1], c[2], alphaValue);
}

function buildBarProfiles(baseHeights) {
  // Profile fields:
  // `base` = average band height
  // `a1/a2` = wave amplitudes
  // `f1/f2` = wave frequencies
  // `p1/p2` = wave phase offsets
  let profiles = [];
  for (let i = 0; i < baseHeights.length; i++) {
    profiles.push({
      base: baseHeights[i],
      a1: random(0.12, 0.33),
      a2: random(0.05, 0.16),
      f1: random(0.8, 1.8),
      f2: random(1.8, 3.7),
      p1: random(TWO_PI),
      p2: random(TWO_PI),
    });
  }
  return profiles;
}

function buildBoundariesFromProfiles(profiles, yTop, totalHeight, minGap) {
  // One more boundary than bars: top boundary + boundaries between bars + bottom boundary.
  let boundaries = Array.from({ length: profiles.length + 1 }, () => []);

  // For each sampled x-position, compute all band thicknesses then stack boundaries.
  for (let s = 0; s < curveSampleCount; s++) {
    let t = s / (curveSampleCount - 1); // normalized x sample in [0,1]
    let localGaps = []; // thickness of each bar at this x sample
    let localTotal = 0; // sum of all local gaps

    for (let b = 0; b < profiles.length; b++) {
      let p = profiles[b]; // current profile
      let wave =
        1 +
        p.a1 * sin(TWO_PI * p.f1 * t + p.p1) +
        p.a2 * sin(TWO_PI * p.f2 * t + p.p2);
      let gap = max(minGap, p.base * wave);
      localGaps.push(gap);
      localTotal += gap;
    }

    // Normalize this x-column so all bars fit exactly into totalHeight.
    let scale = totalHeight / localTotal;
    let yCursor = yTop; // running y while stacking boundaries top -> bottom
    boundaries[0][s] = yCursor;
    for (let b = 0; b < profiles.length; b++) {
      yCursor += localGaps[b] * scale;
      boundaries[b + 1][s] = yCursor;
    }
  }

  return boundaries;
}

function buildCenterCurves(boundaries) {
  // Center curve for bar b is midpoint between boundaries b and b+1.
  let centers = [];
  for (let b = 0; b < boundaries.length - 1; b++) {
    let center = [];
    for (let s = 0; s < curveSampleCount; s++) {
      center.push((boundaries[b][s] + boundaries[b + 1][s]) * 0.5);
    }
    centers.push(center);
  }
  return centers;
}

function buildRelationshipItems(barCount, x0, x1, spanW, boundaries) {
  let items = [];

  // Process one curved bar at a time.
  for (let b = 0; b < barCount; b++) {
    let cols = floor(random(2, 5)); // number of vertical cells in this bar
    let minCellW = max(70, spanW * 0.09);
    let maxCellW = spanW * 0.45;
    let colWidths = randomPartition(spanW, cols, minCellW, maxCellW);

    let x = x0; // running x position for left edge of each cell
    for (let c = 0; c < colWidths.length; c++) {
      let w = colWidths[c]; // this cell width
      let xL = x; // left x of cell
      let xR = x + w; // right x of cell

      // Inset dot anchors from cell edges.
      let edgePad = min(18, w * 0.12);
      let ax = xL + edgePad;
      let bx = xR - edgePad;

      if (bx - ax > 24) {
        // Measure local band thickness at this cell center for initial rectangle sizing.
        let midX = (ax + bx) * 0.5;
        let topY = sampleCurveAtX(boundaries[b], x0, x1, midX);
        let botY = sampleCurveAtX(boundaries[b + 1], x0, x1, midX);
        let bandH = max(12, botY - topY);

        let rectHeight = constrain(bandH * 0.56, 12, bandH * 0.9);
        let rectWidth = constrain(rectHeight * random(0.14, 0.24), 3, 14);
        let numRects = floor(random(10, 25));

        items.push({
          id: `bar_${b}_cell_${c}`,
          barIndex: b,
          ax: ax,
          bx: bx,
          rectWidth: rectWidth,
          rectHeight: rectHeight,
          numRects: numRects,
        });
      }

      // Move to next cell.
      x += w;
    }
  }

  return items;
}

function randomPartition(total, count, minSize, maxSize) {
  // Split a total length into random pieces with min/max constraints.
  let sizes = []; // output piece sizes
  let remaining = total; // still-unassigned length
  let remainingParts = count; // pieces left to create

  for (let i = 0; i < count - 1; i++) {
    let minAllowed = max(minSize, remaining - maxSize * (remainingParts - 1)); // keep future pieces feasible
    let maxAllowed = min(maxSize, remaining - minSize * (remainingParts - 1)); // keep future pieces feasible
    let size = random(minAllowed, maxAllowed); // sample current piece size
    sizes.push(size);
    remaining -= size;
    remainingParts--;
  }

  sizes.push(remaining);
  return sizes;
}

function sampleCurveAtX(curve, x0, x1, x) {
  // Sample a 1D curve array at world x using linear interpolation.
  let t = constrain((x - x0) / max(1e-6, x1 - x0), 0, 1); // normalized x in [0,1]
  let idx = t * (curve.length - 1); // floating array index
  let i0 = floor(idx); // left integer sample index
  let i1 = min(curve.length - 1, i0 + 1); // right integer sample index
  let f = idx - i0; // blend factor between i0 and i1
  return lerp(curve[i0], curve[i1], f);
}

function updateAndDrawRelationship(item, ay, by) {
  // Compute relationship axis info.
  let w = dist(item.ax, ay, item.bx, by);

  // Build a state key so geometry/config changes recreate state.
  let key = [
    item.id,
    w,
    item.rectWidth,
    item.rectHeight,
    item.numRects,
    sortingAlgorithm,
    removeGroupSize,
    removeMode,
  ].join("|");

  // Create relationship state when needed.
  if (!relationshipStates[item.id] || relationshipStates[item.id].key !== key) {
    relationshipStates[item.id] = createRelationshipState(
      key,
      item,
      w,
      item.rectWidth,
      item.rectHeight,
      item.numRects,
    );
  }

  // Update dynamic anchors each frame.
  let state = relationshipStates[item.id]; // persistent state object for this relationship id
  state.ax = item.ax; // world x of left endpoint (dot A)
  state.ay = ay; // world y of left endpoint sampled from center curve
  state.bx = item.bx; // world x of right endpoint (dot B)
  state.by = by; // world y of right endpoint sampled from center curve
  state.barIndex = item.barIndex; // which curved bar this relationship belongs to

  // Update simulation and render.
  updateRelationship(state);
  drawRelationship(state);
}

function createRelationshipState(
  key,
  item,
  w,
  rectWidth,
  rectHeight,
  numRects,
) {
  // Dot size scales with base rectangle height.
  let dotSize = max(8, rectHeight * 0.48);

  // Inner padding between dots and rectangle zone.
  let sidePadding = 24;

  // Base local coordinates where center is 0.
  let leftX = -w / 2;
  let rightX = w / 2;

  // Calculate available width for rectangles.
  let innerLeft = leftX + dotSize / 2 + sidePadding;
  let innerRight = rightX - dotSize / 2 - sidePadding;
  let available = innerRight - innerLeft;

  // Clamp rectangle count to fit available space.
  let maxFit = max(1, floor(available / rectWidth));
  let count = constrain(floor(numRects), 1, maxFit);

  // Uniform gap between rectangles.
  let gap = count > 1 ? (available - count * rectWidth) / (count - 1) : 0;

  // Build slot x positions.
  let usedWidth = count * rectWidth + (count - 1) * gap;
  let startX = -usedWidth / 2;
  let slots = [];
  for (let i = 0; i < count; i++) {
    slots.push(startX + i * (rectWidth + gap));
  }

  // Mono dot colors.
  let dotColorA = color(dotColorDark);
  let dotColorB = color(dotColorLight);

  // Initialize rectangles with id and noise seeds.
  let rects = [];
  for (let id = 1; id <= count; id++) {
    rects.push({
      id: id,
      x: 0,
      targetX: 0,
      w: rectWidth,
      h: rectHeight,
      // noiseSeedW: random(1000),
      // noiseSeedH: random(1000),
    });
  }

  // Shuffle initial order.
  shuffleArray(rects);

  // Build initial swap plan.
  let activeAlgorithm = resolveSortingAlgorithm(sortingAlgorithm);
  let swapPlan = buildSwapPlan(
    rects.map((r) => r.id),
    activeAlgorithm,
  );

  // Place rectangles on slots.
  for (let i = 0; i < rects.length; i++) {
    rects[i].x = slots[i];
    rects[i].targetX = slots[i];
  }

  // Return full runtime state.
  return {
    key: key,
    ax: item.ax, // cached left endpoint x in world space
    ay: 0, // cached left endpoint y in world space (updated every frame)
    bx: item.bx, // cached right endpoint x in world space
    by: 0, // cached right endpoint y in world space (updated every frame)
    barIndex: item.barIndex, // index into relationshipLayout curves
    baseLeftX: leftX, // original local left-dot x (used for stable normalization)
    baseRightX: rightX, // original local right-dot x (used for stable normalization)
    leftX: leftX, // current animated local left-dot x
    rightX: rightX, // current animated local right-dot x
    targetLeftX: leftX, // target local left-dot x
    targetRightX: rightX, // target local right-dot x
    dotSize: dotSize, // baseline dot diameter
    currentDotSize: dotSize, // animated dot diameter after heartbeat/merge effects
    dotColorA: dotColorA, // color of left dot
    dotColorB: dotColorB, // color of right dot
    sidePadding: sidePadding, // fixed local padding between dots and rectangle area
    gap: gap, // spacing between neighboring rectangles
    baseCount: count, // original rectangle count for respawn
    rectWidth: rectWidth, // average/base rectangle width
    rectHeight: rectHeight, // average/base rectangle height
    slots: slots, // target x slots for rectangle placement
    rects: rects, // live rectangle objects
    swapPlan: swapPlan, // precomputed swap steps for current sorting algorithm
    swapIndex: 0, // next swap step index
    activeAlgorithm: activeAlgorithm, // resolved algorithm for this cycle
    done: false, // true when swap plan is finished
    merging: false, // true after rectangles disappear and dots begin merge
    mergeStartDistance: 0, // dot distance when merge begins (for normalized progress)
    mergePauseStarted: false, // true once fully merged and hold phase starts
    mergePauseStart: 0, // millis timestamp of hold-phase start
    mergePauseUntil: 0, // millis timestamp when hold phase ends
    mergeChaos: 0, // 0..1 ramp during hold phase for shake intensity
    lastStepTime: millis(), // last timestamp used for step-based sorting cadence
  };
}

function updateRelationship(state) {
  // Update rectangle target x positions from current slots.
  for (let i = 0; i < state.rects.length; i++) {
    state.rects[i].targetX = state.slots[i];
  }

  // Animate dot spacing toward targets.
  state.leftX = lerp(state.leftX, state.targetLeftX, moveEase);
  state.rightX = lerp(state.rightX, state.targetRightX, moveEase);

  // Noise metric disabled.
  // let noiseSum = 0;

  // Animate rectangle positions/sizes.
  for (let rectObj of state.rects) {
    // Move rectangle x toward its slot.
    rectObj.x = lerp(rectObj.x, rectObj.targetX, moveEase);

    // Width noise disabled: keep base width.
    // let nW = noise(rectObj.noiseSeedW, frameCount * noiseSpeedW);
    // let ampW = max(0, noiseAmplitudeW);
    // let widthScale = max(0.1, 1 + ampW * (nW * 2 - 1));
    // rectObj.w = state.rectWidth * widthScale;
    rectObj.w = state.rectWidth;

    // Height from local band thickness + noise.
    let centerLocalX = rectObj.x + state.rectWidth * 0.5;
    let centerPt = curvePointForLocalX(state, centerLocalX);
    let bandH = bandHeightAtWorldX(state, centerPt.x);
    let baseH = max(8, bandH * 0.62);

    // Height noise disabled: follow curved band only.
    // let nH = noise(rectObj.noiseSeedH, frameCount * noiseSpeedH);
    // let ampH = max(0, noiseAmplitudeH);
    // let heightScale = max(0.1, 1 + ampH * (nH * 2 - 1));
    // rectObj.h = lerp(rectObj.h, baseH * heightScale, 0.22);
    rectObj.h = lerp(rectObj.h, baseH, 0.22);

    // noiseSum += (nW + nH) * 0.5;
  }

  // Dot heartbeat uses a stable fallback since noise is disabled.
  let avgNoise = 0.5;
  let beatSpeed = lerp(0.18, 0.34, avgNoise);
  let beatPhase = frameCount * beatSpeed + avgNoise * TWO_PI * 2.0;
  let beatShape = pow(max(0, sin(beatPhase)), 8);
  let targetDotSize = state.dotSize * (1 + dotBeatAmount * beatShape);
  state.currentDotSize = lerp(state.currentDotSize, targetDotSize, 0.25);

  // Handle merge/pause/respawn phase when no rectangles remain.
  if (state.rects.length === 0) {
    updateMergePhase(state);
    return;
  }

  // Sort only when all moving elements have settled.
  if (!allSettled(state)) return;

  // Try rectangle removal according to current mode.
  if (tryRemoveRectangles(state)) {
    state.lastStepTime = millis();
    return;
  }

  // Stop if current set already sorted and no more swaps.
  if (state.done) return;

  // Apply sort step at configured cadence.
  let stepDelayMs = 1000 / max(0.1, sortStepsPerSecond);
  if (millis() - state.lastStepTime < stepDelayMs) return;
  state.lastStepTime = millis();

  // Finish when swap plan consumed.
  if (state.swapIndex >= state.swapPlan.length) {
    state.done = true;
    return;
  }

  // Execute one swap.
  let pair = state.swapPlan[state.swapIndex];
  let a = pair[0];
  let b = pair[1];
  let tmp = state.rects[a];
  state.rects[a] = state.rects[b];
  state.rects[b] = tmp;
  state.swapIndex++;
}

function updateMergePhase(state) {
  // Initialize merge phase once.
  if (!state.merging) {
    state.merging = true;
    state.mergeStartDistance = max(1, abs(state.rightX - state.leftX));
    state.targetLeftX = 0;
    state.targetRightX = 0;
    state.mergePauseStarted = false;
    state.mergePauseStart = 0;
    state.mergePauseUntil = 0;
    state.mergeChaos = 0;
  }

  // Hold a slightly larger dot while merged.
  state.currentDotSize = lerp(state.currentDotSize, state.dotSize * 1.12, 0.2);

  // Start pause when fully merged.
  let mergedDistance = abs(state.rightX - state.leftX);
  if (!state.mergePauseStarted && mergedDistance < 0.8) {
    state.mergePauseStarted = true;
    state.mergePauseStart = millis();
    state.mergePauseUntil = millis() + random(mergePauseMinMs, mergePauseMaxMs);
    state.leftX = 0;
    state.rightX = 0;
  }

  // Increase chaos during pause.
  if (state.mergePauseStarted) {
    let total = max(1, state.mergePauseUntil - state.mergePauseStart);
    let elapsed = millis() - state.mergePauseStart;
    state.mergeChaos = constrain(elapsed / total, 0, 1);
  } else {
    state.mergeChaos = 0;
  }

  // Respawn when pause is over.
  if (state.mergePauseStarted && millis() >= state.mergePauseUntil) {
    respawnRectangles(state);
  }
}

function drawRelationship(state) {
  noStroke();

  // Draw merged phase.
  if (state.rects.length === 0) {
    drawMergedDots(state);
    return;
  }

  // Draw two endpoint dots.
  let leftPt = curvePointForLocalX(state, state.leftX);
  let rightPt = curvePointForLocalX(state, state.rightX);
  fill(state.dotColorA);
  circle(leftPt.x, leftPt.y, state.currentDotSize);
  fill(state.dotColorB);
  circle(rightPt.x, rightPt.y, state.currentDotSize);

  // Draw rectangles.
  rectMode(CENTER);
  let gradientById = buildGradientTById(state.rects);
  for (let rectObj of state.rects) {
    let centerLocalX = rectObj.x + state.rectWidth / 2;
    let centerPt = curvePointForLocalX(state, centerLocalX);
    let t = gradientById[rectObj.id];
    fill(lerpColor(state.dotColorA, state.dotColorB, t));
    rect(centerPt.x, centerPt.y, rectObj.w, rectObj.h);
  }
}

function drawMergedDots(state) {
  // Compute points for merge animation.
  let leftPt = curvePointForLocalX(state, state.leftX);
  let rightPt = curvePointForLocalX(state, state.rightX);
  let mergedLocalX = (state.leftX + state.rightX) * 0.5;
  let mergedPt = curvePointForLocalX(state, mergedLocalX);

  // Compute merge progress based on dot distance.
  let d = dist(leftPt.x, leftPt.y, rightPt.x, rightPt.y);
  let mergeT = 1 - d / max(1, state.mergeStartDistance);
  mergeT = constrain(mergeT, 0, 1);

  // Add shake during pause.
  let chaos = pow(state.mergeChaos, 1.35);
  let shakeAmp = lerp(0.2, mergeShakeMaxOffset, chaos);
  let shakeFreq = lerp(0.2, 1.6, chaos);
  let jx = sin(frameCount * shakeFreq * 0.73 + state.dotSize) * shakeAmp;
  let jy = cos(frameCount * shakeFreq * 0.91 + state.dotSize * 0.37) * shakeAmp;
  let x = mergedPt.x + jx;
  let y = mergedPt.y + jy;
  let mergedSize = state.currentDotSize * 1.12;

  // Avoid ghost overlap: draw either split dots or pink dot.
  if (mergeT < mergePinkOnlyThreshold) {
    fill(state.dotColorA);
    circle(leftPt.x, leftPt.y, state.currentDotSize);
    fill(state.dotColorB);
    circle(rightPt.x, rightPt.y, state.currentDotSize);
    return;
  }

  // Draw merged pink dot.
  fill(mergedDotColor);
  circle(x, y, mergedSize);
}

function curvePointForLocalX(state, localX) {
  // Map local x to normalized t based on original full span.
  let denom = state.baseRightX - state.baseLeftX; // total original local span between the two dots
  let t = abs(denom) < 1e-6 ? 0.5 : (localX - state.baseLeftX) / denom; // normalized position along span
  t = constrain(t, 0, 1);

  // Base point on dot axis.
  let x = lerp(state.ax, state.bx, t); // world x between endpoints A->B
  let y = lerp(state.ay, state.by, t); // linear y between endpoints A->B (fallback)

  // Override y by bar center curve for this relationship.
  if (
    relationshipLayout &&
    state.barIndex !== null &&
    state.barIndex !== undefined
  ) {
    y = sampleCurveAtX(
      relationshipLayout.centerCurves[state.barIndex],
      relationshipLayout.x0,
      relationshipLayout.x1,
      x,
    );
  }

  return { x: x, y: y };
}

function bandHeightAtWorldX(state, x) {
  // Fallback if layout unavailable.
  if (
    !relationshipLayout ||
    state.barIndex === null ||
    state.barIndex === undefined
  ) {
    return state.rectHeight / 0.62;
  }

  // Sample top and bottom boundaries at x.
  let top = sampleCurveAtX(
    relationshipLayout.boundaries[state.barIndex],
    relationshipLayout.x0,
    relationshipLayout.x1,
    x,
  );
  let bottom = sampleCurveAtX(
    relationshipLayout.boundaries[state.barIndex + 1],
    relationshipLayout.x0,
    relationshipLayout.x1,
    x,
  );

  return max(8, bottom - top); // local curved bar thickness at x
}

function allRectsSettled(rects) {
  // True when all rectangle x positions are near targets.
  for (let rectObj of rects) {
    if (abs(rectObj.x - rectObj.targetX) > 0.5) return false;
  }
  return true;
}

function allSettled(state) {
  // True when dots and rectangles are all near targets.
  if (abs(state.leftX - state.targetLeftX) > 0.5) return false;
  if (abs(state.rightX - state.targetRightX) > 0.5) return false;
  return allRectsSettled(state.rects);
}

function shuffleArray(arr) {
  // Fisher-Yates shuffle.
  for (let i = arr.length - 1; i > 0; i--) {
    let j = floor(random(i + 1));
    let tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function buildSwapPlan(ids, algorithm) {
  // Build swap operations for selected sorting algorithm.
  let arr = ids.slice();
  let swaps = [];

  if (algorithm === "selection") {
    for (let i = 0; i < arr.length - 1; i++) {
      let minIndex = i;
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[j] < arr[minIndex]) minIndex = j;
      }
      if (minIndex !== i) {
        swaps.push([i, minIndex]);
        let tmp = arr[i];
        arr[i] = arr[minIndex];
        arr[minIndex] = tmp;
      }
    }
    return swaps;
  }

  if (algorithm === "insertion") {
    for (let i = 1; i < arr.length; i++) {
      let j = i;
      while (j > 0 && arr[j - 1] > arr[j]) {
        swaps.push([j - 1, j]);
        let tmp = arr[j - 1];
        arr[j - 1] = arr[j];
        arr[j] = tmp;
        j--;
      }
    }
    return swaps;
  }

  // Default bubble sort.
  for (let pass = 0; pass < arr.length - 1; pass++) {
    for (let i = 0; i < arr.length - 1 - pass; i++) {
      if (arr[i] > arr[i + 1]) {
        swaps.push([i, i + 1]);
        let tmp = arr[i];
        arr[i] = arr[i + 1];
        arr[i + 1] = tmp;
      }
    }
  }
  return swaps;
}

function tryRemoveRectangles(state) {
  // Dispatch removal strategy.
  if (removeMode === "correct_position") return tryRemoveCorrectPosition(state);
  return tryRemoveAscendingGroup(state);
}

function tryRemoveAscendingGroup(state) {
  // Remove runs of N ascending consecutive remaining IDs.
  let n = max(1, floor(removeGroupSize));
  if (state.rects.length === 0) return false;

  let removed = false;

  // For less than N, remove all when ordered.
  if (state.rects.length < n) {
    if (isAscendingConsecutive(state.rects)) {
      state.rects.splice(0, state.rects.length);
      removed = true;
    }
  } else {
    // Repeatedly remove first matching run until none left.
    let start = findAscendingRunStart(state.rects, n);
    while (start >= 0) {
      state.rects.splice(start, n);
      removed = true;
      start = findAscendingRunStart(state.rects, n);
    }
  }

  if (!removed) return false;
  relayoutRelationship(state);
  rebuildSortForCurrentOrder(state);
  return true;
}

function tryRemoveCorrectPosition(state) {
  // Remove any rectangle already at its correct index among remaining IDs.
  if (state.rects.length === 0) return false;

  let expected = state.rects
    .map((r) => r.id)
    .slice()
    .sort((a, b) => a - b);

  let kept = [];
  let removed = false;

  for (let i = 0; i < state.rects.length; i++) {
    if (state.rects[i].id === expected[i]) {
      removed = true;
    } else {
      kept.push(state.rects[i]);
    }
  }

  if (!removed) return false;
  state.rects = kept;
  relayoutRelationship(state);
  rebuildSortForCurrentOrder(state);
  return true;
}

function findAscendingRunStart(rects, n) {
  // Find first index where length-n run follows remaining-id adjacency.
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
  // Check if all remaining rectangles are in ascending remaining-id order.
  if (rects.length <= 1) return rects.length === 1;

  let nextMap = buildNextRemainingIdMap(rects);
  for (let i = 1; i < rects.length; i++) {
    if (nextMap[rects[i - 1].id] !== rects[i].id) return false;
  }
  return true;
}

function buildNextRemainingIdMap(rects) {
  // Build map id -> next higher remaining id.
  let ids = rects
    .map((r) => r.id)
    .slice()
    .sort((a, b) => a - b);

  let map = {};
  for (let i = 0; i < ids.length - 1; i++) {
    map[ids[i]] = ids[i + 1];
  }
  return map;
}

function relayoutRelationship(state) {
  // Recompute dot target spacing and rectangle slots after removals.
  let count = state.rects.length;
  let usedWidth =
    count > 0 ? count * state.rectWidth + (count - 1) * state.gap : 0;

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
  // Rebuild swap plan for current remaining IDs.
  state.swapPlan = buildSwapPlan(
    state.rects.map((r) => r.id),
    state.activeAlgorithm,
  );
  state.swapIndex = 0;
  state.done = state.swapPlan.length === 0;
}

function respawnRectangles(state) {
  // Respawn original count with fresh shuffle.
  let count = state.baseCount;
  let rects = [];

  for (let id = 1; id <= count; id++) {
    rects.push({
      id: id,
      x: 0,
      targetX: 0,
      w: state.rectWidth,
      h: state.rectHeight,
      // noiseSeedW: random(1000),
      // noiseSeedH: random(1000),
    });
  }

  shuffleArray(rects);
  state.rects = rects;

  // Rebuild slots and target spacing.
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

  // Rebuild sorting mode/plan and clear merge state.
  state.activeAlgorithm = resolveSortingAlgorithm(sortingAlgorithm);
  rebuildSortForCurrentOrder(state);
  state.merging = false;
  state.mergeStartDistance = 0;
  state.mergePauseStarted = false;
  state.mergePauseStart = 0;
  state.mergePauseUntil = 0;
  state.mergeChaos = 0;

  state.lastStepTime = millis();
}

function resolveSortingAlgorithm(algorithm) {
  // Resolve random algorithm per lifecycle.
  if (algorithm !== "random") return algorithm;
  let options = ["bubble", "selection", "insertion"];
  return random(options);
}

function buildGradientTById(rects) {
  // Map each remaining id to a 0..1 gradient value based on sorted order.
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
