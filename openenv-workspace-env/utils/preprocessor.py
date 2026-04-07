"""
utils/preprocessor.py — Observation feature pipeline.

Analogous to an sklearn StandardScaler + LabelEncoder pipeline.
Converts raw environment observation dicts into fixed-length discrete
feature vectors that agents can consume.

STEP 1 fix: guarantees training and inference use IDENTICAL feature names,
            feature order, and feature encodings.
STEP 2 fix: save() / load() persist the encoder so inference always
            applies the same transformation as training.

Usage
-----
    from utils.preprocessor import ObservationEncoder

    enc = ObservationEncoder()
    enc.fit()                            # build vocabulary from env constants
    enc.save("models/encoder.json")     # persist for inference

    feature_vec = enc.transform(obs)    # training
    feature_vec = enc.transform(obs)    # inference  ← same call, same output
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

# ── Feature vocabulary (fixed at design time) ─────────────────────────────────

_APP_VOCAB = ["task_manager", "email_inbox", "email_detail", "calendar", "documents"]
_TASK_VOCAB = ["ws_task_1", "ws_task_2", "ws_task_3",
               "dynamic_find_email", "dynamic_schedule_meeting", "dynamic_organize_document"]
_DIFFICULTY_VOCAB = ["easy", "medium", "hard"]

# STEP 1: canonical feature names in exact order used during training
FEATURE_NAMES: list[str] = [
    "task_id_enc",          # int 0-5  (task vocabulary index)
    "current_app_enc",      # int 0-4  (app vocabulary index)
    "has_selected_email",   # bool 0/1
    "target_email_open",    # bool 0/1 (selected_email.id == target)
    "extracted_meeting",    # bool 0/1
    "step_bucket",          # int 0-3  (step_count // 3, capped at 3)
]
N_FEATURES = len(FEATURE_NAMES)


class ObservationEncoder:
    """
    Deterministic, stateless observation encoder.

    fit()      — records vocabulary so save/load round-trip is lossless
    transform(obs) → tuple[int, ...] of length N_FEATURES (= 6)
    save(path) — writes encoder config to JSON
    load(path) — restores from JSON
    validate(obs) → list[str] of error messages (empty = OK)
    """

    VERSION = "1.0"

    def __init__(self) -> None:
        self._app_vocab:        list[str] = list(_APP_VOCAB)
        self._task_vocab:       list[str] = list(_TASK_VOCAB)
        self._difficulty_vocab: list[str] = list(_DIFFICULTY_VOCAB)
        self._fitted:           bool      = False

    # ── Public API ─────────────────────────────────────────────────────────────

    def fit(self) -> "ObservationEncoder":
        """
        Build vocabulary from environment constants.
        Call once before training; then save() and reuse at inference.
        """
        self._app_vocab        = list(_APP_VOCAB)
        self._task_vocab       = list(_TASK_VOCAB)
        self._difficulty_vocab = list(_DIFFICULTY_VOCAB)
        self._fitted           = True
        log.info(
            "ObservationEncoder fitted | apps=%d tasks=%d features=%d",
            len(self._app_vocab), len(self._task_vocab), N_FEATURES,
        )
        return self

    def transform(self, obs: dict) -> tuple:
        """
        Convert one observation dict to a fixed-length discrete feature tuple.

        STEP 1 guarantee: feature names and order are identical to training.
        STEP 4 guarantee: output always has exactly N_FEATURES (6) elements.
        """
        if not self._fitted:
            raise RuntimeError(
                "ObservationEncoder not fitted. Call fit() before transform(), "
                "or load() a previously saved encoder."
            )

        task_id  = obs.get("task_id", "ws_task_1")
        app      = obs.get("current_app", "task_manager")
        sel      = obs.get("selected_email")
        step     = obs.get("step_count", 0)

        task_enc = self._idx(self._task_vocab, task_id)
        app_enc  = self._idx(self._app_vocab,  app)
        has_sel  = int(sel is not None)
        tgt_open = int(sel is not None and sel.get("id") == "email_001")
        extracted = int(obs.get("extracted_meeting_details", False))

        # Calendar growth is a proxy for extraction when obs omits the flag
        if not extracted and isinstance(obs.get("calendar_events"), list):
            extracted = int(any(e.get("created_from_email") for e in obs["calendar_events"]))

        step_bucket = min(step // 3, 3)

        return (task_enc, app_enc, has_sel, tgt_open, extracted, step_bucket)

    def validate(self, obs: dict) -> list[str]:
        """
        STEP 5 — real-time input validation.

        Returns a list of error/warning strings. An empty list means the
        observation passes all checks and is safe to transform().
        """
        errors: list[str] = []
        required_keys = {
            "task_id", "current_app", "available_actions",
            "email_list", "documents", "calendar_events",
            "step_count", "total_reward",
        }

        # Missing features
        for key in required_keys:
            if key not in obs:
                errors.append(f"MISSING feature: '{key}'")
            elif obs[key] is None:
                errors.append(f"NULL value for: '{key}'")

        # Type checks
        if "step_count" in obs and not isinstance(obs["step_count"], int):
            errors.append(f"WRONG TYPE: step_count is {type(obs['step_count']).__name__} (expected int)")

        if "total_reward" in obs and not isinstance(obs["total_reward"], (int, float)):
            errors.append(f"WRONG TYPE: total_reward is {type(obs['total_reward']).__name__} (expected float)")

        if "available_actions" in obs and obs["available_actions"] is not None:
            if not isinstance(obs["available_actions"], list) or len(obs["available_actions"]) == 0:
                errors.append("available_actions is empty — agent cannot act")

        # Unknown task_id
        task_id = obs.get("task_id", "")
        if task_id and task_id not in self._task_vocab:
            errors.append(f"UNKNOWN task_id '{task_id}' — not in training vocabulary")

        # Unknown app
        app = obs.get("current_app", "")
        if app and app not in self._app_vocab:
            errors.append(f"UNKNOWN current_app '{app}' — not in training vocabulary")

        # Shape check: output would be N_FEATURES dims
        if self._fitted and not errors:
            try:
                enc = self.transform(obs)
                if len(enc) != N_FEATURES:
                    errors.append(f"SHAPE MISMATCH: encoded {len(enc)} features, expected {N_FEATURES}")
            except Exception as exc:
                errors.append(f"ENCODING ERROR: {exc}")

        return errors

    def feature_info(self) -> dict:
        """Return metadata about the feature pipeline (for audit/debug output)."""
        return {
            "feature_names":   FEATURE_NAMES,
            "n_features":      N_FEATURES,
            "app_vocabulary":  self._app_vocab,
            "task_vocabulary": self._task_vocab,
            "fitted":          self._fitted,
            "version":         self.VERSION,
        }

    # ── Persistence ────────────────────────────────────────────────────────────

    def save(self, path: str | Path = "models/encoder.json") -> None:
        """
        STEP 2 fix — persist encoder so inference loads the exact same
        transformation used during training.
        """
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        config = {
            "version":            self.VERSION,
            "app_vocabulary":     self._app_vocab,
            "task_vocabulary":    self._task_vocab,
            "difficulty_vocabulary": self._difficulty_vocab,
            "feature_names":      FEATURE_NAMES,
            "n_features":         N_FEATURES,
        }
        Path(path).write_text(json.dumps(config, indent=2))
        log.info("ObservationEncoder saved → %s", path)

    @classmethod
    def load(cls, path: str | Path = "models/encoder.json") -> "ObservationEncoder":
        """
        STEP 2 fix — load saved encoder at inference time.

        Raises FileNotFoundError if the encoder has never been saved.
        """
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(
                f"Encoder not found at '{path}'. "
                "Run train.py first to fit and save the encoder."
            )
        config       = json.loads(p.read_text())
        enc          = cls()
        enc._app_vocab        = config.get("app_vocabulary",  list(_APP_VOCAB))
        enc._task_vocab       = config.get("task_vocabulary", list(_TASK_VOCAB))
        enc._difficulty_vocab = config.get("difficulty_vocabulary", list(_DIFFICULTY_VOCAB))
        enc._fitted           = True
        log.info("ObservationEncoder loaded ← %s", path)
        return enc

    # ── Private helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _idx(vocab: list[str], value: str) -> int:
        """Return vocabulary index, defaulting to 0 for unknown values."""
        try:
            return vocab.index(value)
        except ValueError:
            return 0
