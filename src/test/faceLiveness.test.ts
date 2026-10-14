import { describe, expect, it } from "vitest";
import {
  areLivenessStepsComplete,
  calculateEyeAspectRatio,
  hasLiveVideoTrack,
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
});
