interface Pose2dData {
  x: number;
  y: number;
  heading: number;
}

interface SplineSegment {
  type: "linear" | "tangential";
  start: Pose2dData;
  end: Pose2dData;
  controlPoints: { x: number; y: number }[];
}

export function parseJavaCode(javaCode: string): { startPoint: Point; lines: Line[] } | null {
  try {
    const segments = parseSplineSegments(javaCode);

    if (segments.length < 1) {
      return null;
    }

    const firstSegment = segments[0];
    const startPoint: Point = {
      x: firstSegment.start.x,
      y: firstSegment.start.y,
      heading: "linear",
      startDeg: radiansToDegrees(firstSegment.start.heading),
      endDeg: radiansToDegrees(firstSegment.start.heading)
    };

    const lines: Line[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const controlPoints = generateQuinticControlPoints(segment);

      const heading: any = segment.type === "tangential"
        ? { heading: "tangential", reverse: false }
        : {
            heading: "linear",
            startDeg: radiansToDegrees(segment.start.heading),
            endDeg: radiansToDegrees(segment.end.heading)
          };

      lines.push({
        endPoint: {
          x: segment.end.x,
          y: segment.end.y,
          ...heading
        },
        controlPoints: controlPoints,
        color: getRandomColor()
      });
    }

    return { startPoint, lines };
  } catch (error) {
    console.error("Error parsing Java code:", error);
    return null;
  }
}

function parseSplineSegments(javaCode: string): SplineSegment[] {
  const segments: SplineSegment[] = [];

  // Pattern to match new Pose2d(...) with both Math.toRadians() and direct radians
  const pose2dPattern = /new\s+Pose2d\s*\(\s*([-+]?\d+\.?\d*)\s*,\s*([-+]?\d+\.?\d*)\s*,\s*(?:Math\.toRadians\s*\(\s*)?([-+]?\d+\.?\d*)\s*\)?\s*\)/g;

  // Find all spline method calls (linearTo, tangentialTo, splineTo)
  const splineCallPattern = /\.(linearTo|tangentialTo|splineTo)\s*\(\s*new\s+Pose2d\s*\(\s*([-+]?\d+\.?\d*)\s*,\s*([-+]?\d+\.?\d*)\s*,\s*(?:Math\.toRadians\s*\(\s*)?([-+]?\d+\.?\d*)\s*\)?\s*\)\s*\)/g;

  const splineCalls: Array<{ type: string; pose: Pose2dData; index: number; hasToRadians: boolean }> = [];
  let match;

  while ((match = splineCallPattern.exec(javaCode)) !== null) {
    const hasToRadians = match[0].includes('Math.toRadians');
    splineCalls.push({
      type: match[1],
      pose: {
        x: parseFloat(match[2]),
        y: parseFloat(match[3]),
        heading: hasToRadians ? parseFloat(match[4]) : parseFloat(match[4]) * Math.PI / 180
      },
      index: match.index,
      hasToRadians: hasToRadians
    });
  }

  // If spline calls found, use them to build segments
  if (splineCalls.length > 0) {
    // Find the starting pose (first Pose2d that's not in a spline call)
    const firstCallIndex = splineCalls[0].index;
    const beforeFirstCall = javaCode.substring(0, firstCallIndex);

    pose2dPattern.lastIndex = 0;
    const startMatch = pose2dPattern.exec(beforeFirstCall);

    if (startMatch) {
      const hasToRadians = startMatch[0].includes('Math.toRadians');
      const startPose: Pose2dData = {
        x: parseFloat(startMatch[1]),
        y: parseFloat(startMatch[2]),
        heading: hasToRadians ? parseFloat(startMatch[3]) : parseFloat(startMatch[3]) * Math.PI / 180
      };

      for (let i = 0; i < splineCalls.length; i++) {
        const currentStart = i === 0 ? startPose : splineCalls[i - 1].pose;
        const call = splineCalls[i];

        segments.push({
          type: call.type === "linearTo" ? "linear" : "tangential",
          start: currentStart,
          end: call.pose,
          controlPoints: []
        });
      }

      return segments;
    }
  }

  // Fallback: Find all Pose2d objects and create linear segments
  const poses: Pose2dData[] = [];
  pose2dPattern.lastIndex = 0;

  while ((match = pose2dPattern.exec(javaCode)) !== null) {
    const hasToRadians = match[0].includes('Math.toRadians');
    poses.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      heading: hasToRadians ? parseFloat(match[3]) : parseFloat(match[3]) * Math.PI / 180
    });
  }

  if (poses.length >= 2) {
    for (let i = 1; i < poses.length; i++) {
      segments.push({
        type: "linear",
        start: poses[i - 1],
        end: poses[i],
        controlPoints: []
      });
    }
  }

  return segments;
}

function generateQuinticControlPoints(segment: SplineSegment): { x: number; y: number }[] {
  if (segment.type === "linear") {
    return [];
  }

  // For tangential splines, generate control points based on quintic Hermite
  // matching the TangentialSpline.java implementation
  const p0 = { x: segment.start.x, y: segment.start.y };
  const p1 = { x: segment.end.x, y: segment.end.y };

  const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const scale = dist * 1.2;

  // Velocity vectors based on heading angles (in radians)
  const v0 = {
    x: Math.cos(segment.start.heading) * scale,
    y: Math.sin(segment.start.heading) * scale
  };

  const v1 = {
    x: Math.cos(segment.end.heading) * scale,
    y: Math.sin(segment.end.heading) * scale
  };

  // Sample the quintic Hermite curve at multiple points to approximate with cubic Bezier
  // The quintic uses these coefficients:
  // c5 = p0*(-6) - v0*(3) + p1*(6) - v1*(3)
  // c4 = p0*(15) + v0*(8) - p1*(15) + v1*(7)
  // c3 = p0*(-10) - v0*(6) + p1*(10) - v1*(4)
  // c2 = 0
  // c1 = v0
  // c0 = p0

  // For better approximation, we'll fit cubic Bezier control points
  // by sampling the quintic at t=1/3 and t=2/3
  const samples = 50;
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    const c5x = p0.x * (-6) - v0.x * 3 + p1.x * 6 - v1.x * 3;
    const c5y = p0.y * (-6) - v0.y * 3 + p1.y * 6 - v1.y * 3;
    const c4x = p0.x * 15 + v0.x * 8 - p1.x * 15 + v1.x * 7;
    const c4y = p0.y * 15 + v0.y * 8 - p1.y * 15 + v1.y * 7;
    const c3x = p0.x * (-10) - v0.x * 6 + p1.x * 10 - v1.x * 4;
    const c3y = p0.y * (-10) - v0.y * 6 + p1.y * 10 - v1.y * 4;

    const px = c5x * t5 + c4x * t4 + c3x * t3 + v0.x * t + p0.x;
    const py = c5y * t5 + c4y * t4 + c3y * t3 + v0.y * t + p0.y;

    points.push({ x: px, y: py });
  }

  // Fit cubic Bezier by using velocity-based control points with better scaling
  // This approximation works well for visualization purposes
  const cp1 = {
    x: p0.x + v0.x * 0.25,
    y: p0.y + v0.y * 0.25
  };

  const cp2 = {
    x: p1.x - v1.x * 0.25,
    y: p1.y - v1.y * 0.25
  };

  return [cp1, cp2];
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function getRandomColor() {
  var letters = "56789ABCD";
  var color = "#";
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * letters.length)];
  }
  return color;
}
