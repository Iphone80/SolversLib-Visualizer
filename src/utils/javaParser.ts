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

  // Pattern to match new Pose2d(...) declarations
  const pose2dPattern = /new\s+Pose2d\s*\(\s*([-+]?\d+\.?\d*)\s*,\s*([-+]?\d+\.?\d*)\s*,\s*Math\.toRadians\s*\(\s*([-+]?\d+\.?\d*)\s*\)\s*\)/g;

  // Find all Pose2d objects
  const poses: Pose2dData[] = [];
  let match;

  while ((match = pose2dPattern.exec(javaCode)) !== null) {
    poses.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      heading: parseFloat(match[3])
    });
  }

  if (poses.length < 2) {
    return segments;
  }

  // Find all spline method calls (linearTo, tangentialTo, splineTo)
  const splineCallPattern = /\.(linearTo|tangentialTo|splineTo)\s*\(\s*new\s+Pose2d\s*\(\s*([-+]?\d+\.?\d*)\s*,\s*([-+]?\d+\.?\d*)\s*,\s*Math\.toRadians\s*\(\s*([-+]?\d+\.?\d*)\s*\)\s*\)/g;

  const splineCalls: Array<{ type: string; pose: Pose2dData; index: number }> = [];

  while ((match = splineCallPattern.exec(javaCode)) !== null) {
    splineCalls.push({
      type: match[1],
      pose: {
        x: parseFloat(match[2]),
        y: parseFloat(match[3]),
        heading: parseFloat(match[4])
      },
      index: match.index
    });
  }

  // If no spline calls found, create linear segments between all poses
  if (splineCalls.length === 0) {
    for (let i = 1; i < poses.length; i++) {
      segments.push({
        type: "linear",
        start: poses[i - 1],
        end: poses[i],
        controlPoints: []
      });
    }
    return segments;
  }

  // Create segments based on spline calls
  for (let i = 0; i < splineCalls.length; i++) {
    const startPose = i === 0 ? poses[0] : splineCalls[i - 1].pose;
    const call = splineCalls[i];

    segments.push({
      type: call.type === "linearTo" ? "linear" : "tangential",
      start: startPose,
      end: call.pose,
      controlPoints: []
    });
  }

  return segments;
}

function generateQuinticControlPoints(segment: SplineSegment): { x: number; y: number }[] {
  if (segment.type === "linear") {
    return [];
  }

  // For tangential splines, generate control points based on quintic Hermite
  const p0 = { x: segment.start.x, y: segment.start.y };
  const p1 = { x: segment.end.x, y: segment.end.y };

  const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const scale = Math.max(dist * 1.2, 0.1);

  // Velocity vectors based on heading angles
  const v0 = {
    x: Math.cos(segment.start.heading) * scale,
    y: Math.sin(segment.start.heading) * scale
  };

  const v1 = {
    x: Math.cos(segment.end.heading) * scale,
    y: Math.sin(segment.end.heading) * scale
  };

  // Generate 2 control points to approximate the quintic Hermite curve
  // This gives us a cubic Bezier approximation
  const cp1 = {
    x: p0.x + v0.x / 3,
    y: p0.y + v0.y / 3
  };

  const cp2 = {
    x: p1.x - v1.x / 3,
    y: p1.y - v1.y / 3
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
