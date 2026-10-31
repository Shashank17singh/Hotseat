type Point = { x: number; y: number };

const NOSE_TIP = 1;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;

// Head direction, not gaze: the nose sits near the midpoint of the eyes when a face points at the lens.
export function isFacing(landmarks: Point[]) {
  const nose = landmarks[NOSE_TIP];
  const left = landmarks[LEFT_EYE_OUTER];
  const right = landmarks[RIGHT_EYE_OUTER];
  if (!nose || !left || !right) return false;
  const width = right.x - left.x;
  if (Math.abs(width) < 0.01) return false;
  const position = (nose.x - left.x) / width;
  return position > 0.32 && position < 0.68;
}

export class PresenceTally {
  private samples = 0;
  private facing = 0;

  add(landmarks: Point[] | undefined) {
    this.samples += 1;
    if (landmarks && isFacing(landmarks)) this.facing += 1;
  }

  ratio() {
    return this.samples === 0 ? undefined : Math.round((this.facing / this.samples) * 100) / 100;
  }

  reset() {
    this.samples = 0;
    this.facing = 0;
  }
}
