"""
Velocity calibrator: learns the systematic bias between the AI's initial
story-point estimate and a team's actual (Jira-recorded) points, then
corrects future estimates accordingly.

This is the one piece of classic supervised ML in the pipeline — a small
Ridge regression trained on real historical (estimate -> actual) pairs,
not another LLM call. It activates automatically once enough matched
history accumulates (>= MIN_SAMPLES); until then every story is returned
uncalibrated so the UI never silently guesses on no evidence.
"""
import os
import numpy as np
import joblib
from sklearn.linear_model import Ridge

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "velocity_calibrator.joblib")
MIN_SAMPLES = 5
FIBONACCI = [1, 2, 3, 5, 8, 13, 21]
COMPLEXITY_MAP = {"low": 1, "medium": 2, "high": 3}


class VelocityCalibrator:
    def __init__(self):
        self.model = None
        self.trained_on = 0
        self.r2 = None
        self._load()

    def _load(self):
        if os.path.exists(MODEL_PATH):
            try:
                data = joblib.load(MODEL_PATH)
                self.model = data["model"]
                self.trained_on = data["trained_on"]
                self.r2 = data.get("r2")
            except Exception:
                self.model = None

    @staticmethod
    def _features(story: dict) -> list:
        complexity = COMPLEXITY_MAP.get(str(story.get("complexity", "medium")).lower(), 2)
        return [
            float(story.get("storyPoints", 3) or 3),
            float(story.get("locEstimate", 100) or 100),
            float(len(story.get("affectedFiles", []) or [])),
            float(complexity),
        ]

    def fit(self, samples: list) -> dict:
        """samples: list of (story_dict, actual_jira_points) tuples."""
        clean = [(s, t) for s, t in samples if t and t > 0]
        if len(clean) < MIN_SAMPLES:
            return {
                "trained": False,
                "reason": f"Need >= {MIN_SAMPLES} matched historical samples, have {len(clean)}",
                "samples": len(clean),
            }

        X = np.array([self._features(s) for s, _ in clean])
        y = np.array([float(t) for _, t in clean])

        model = Ridge(alpha=1.0)
        model.fit(X, y)
        r2 = round(float(model.score(X, y)), 3)

        self.model = model
        self.trained_on = len(clean)
        self.r2 = r2

        os.makedirs(MODEL_DIR, exist_ok=True)
        joblib.dump({"model": model, "trained_on": self.trained_on, "r2": r2}, MODEL_PATH)

        return {"trained": True, "samples": len(clean), "r2": r2}

    def calibrate(self, story: dict) -> dict:
        raw = float(story.get("storyPoints", 3) or 3)
        if self.model is None:
            return {"rawEstimate": raw, "calibratedEstimate": raw, "calibrated": False, "trainedOn": 0, "r2": None}

        X = np.array([self._features(story)])
        pred = max(1.0, float(self.model.predict(X)[0]))
        calibrated = min(FIBONACCI, key=lambda f: abs(f - pred))

        return {
            "rawEstimate": raw,
            "calibratedEstimate": calibrated,
            "calibrated": True,
            "trainedOn": self.trained_on,
            "r2": self.r2,
        }

    def status(self) -> dict:
        return {
            "trained": self.model is not None,
            "trainedOn": self.trained_on,
            "r2": self.r2,
            "minSamplesRequired": MIN_SAMPLES,
        }


velocity_calibrator = VelocityCalibrator()
