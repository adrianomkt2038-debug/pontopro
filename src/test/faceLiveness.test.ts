import { describe, expect, it } from "vitest";
import {
  areLivenessStepsComplete,
  calculateBlinkThresholds,
  calculateEyeAspectRatio,
  getHeadTurnDirection,
  hasLiveVideoTrack,
  isHeadBackAtCenter,
  isHeadTurnDetected,
  isPlausibleLivenessDuration,
  isValidLivenessSteps,
} from "@/lib/faceLiveness";

describe("face liveness verification helpers", () => {
  const validOrder = ["turn_left", "blink", "turn_right"] as const;

  it("accepts only a complete, unique three-step challenge", () => {
    expect(isValidLivenessSteps([...validOrder])).toBe(true);
    expect(isValidLivenessSteps(["blink", "blink", "turn_right"])).toBe(false);
    expect(isValidLivenessSteps(["blink", "turn_left"])).toBe(false);
  });

  it("requires the exact server-issued step order", () => {
    expect(areLivenessStepsComplete(validOrder, [...validOrder])).toBe(true);
    expect(areLivenessStepsComplete(validOrder, ["blink", "turn_left", "turn_right"])).toBe(false);
    expect(areLivenessStepsComplete(validOrder, ["turn_left", "blink"])).toBe(false);
  });

  it("rejects implausible proof durations", () => {
    expect(isPlausibleLivenessDuration(4500)).toBe(true);
    expect(isPlausibleLivenessDuration(1000)).toBe(false);
    expect(isPlausibleLivenessDuration(121000)).toBe(false);
    expect(isPlausibleLivenessDuration("5000")).toBe(false);
  });


  it("recognizes live camera tracks without relying on MediaStream instanceof", () => {
    expect(hasLiveVideoTrack({
      getVideoTracks: () => [{ readyState: "live" }],
    })).toBe(true);
    expect(hasLiveVideoTrack({
      getVideoTracks: () => [{ readyState: "ended" }],
    })).toBe(false);
    expect(hasLiveVideoTrack(null)).toBe(false);
    expect(hasLiveVideoTrack({})).toBe(false);
  });

  it("calculates eye aspect ratio safely", () => {
    expect(calculateEyeAspectRatio([
      { x: 0, y: 0 }, { x: 1, y: -1 }, { x: 2, y: -1 }, { x: 4, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 },
    ])).toBeGreaterThan(0);
    expect(calculateEyeAspectRatio([])).toBe(0);
  });

  it("uses relative blink thresholds even for naturally narrow eyes", () => {
    const narrowEyes = calculateBlinkThresholds(0.10);
    expect(narrowEyes.closed).toBeCloseTo(0.07);
    expect(narrowEyes.reopened).toBeCloseTo(0.088);
    expect(narrowEyes.reopened).toBeLessThan(0.10);

    const widerEyes = calculateBlinkThresholds(0.30);
    expect(widerEyes.closed).toBeCloseTo(0.21);
    expect(widerEyes.reopened).toBeCloseTo(0.264);
    expect(widerEyes.reopened).toBeLessThan(0.30);
  });

  it("adapts head-turn detection to mirrored camera direction and requires the opposite second turn", () => {
    expect(getHeadTurnDirection(-0.05)).toBe(-1);
    expect(getHeadTurnDirection(0.05)).toBe(1);
    expect(getHeadTurnDirection(0.02)).toBe(null);
    expect(isHeadTurnDetected(-0.05, null)).toBe(true);
    expect(isHeadTurnDetected(0.05, null)).toBe(true);
    expect(isHeadTurnDetected(-0.05, 1)).toBe(true);
    expect(isHeadTurnDetected(0.05, 1)).toBe(false);
    expect(isHeadBackAtCenter(0.02)).toBe(true);
    expect(isHeadBackAtCenter(-0.02)).toBe(true);
    expect(isHeadBackAtCenter(0.05)).toBe(false);
  });
});
