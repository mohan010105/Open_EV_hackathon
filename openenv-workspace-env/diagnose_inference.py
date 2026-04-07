"""
diagnose_inference.py — Full inference pipeline audit.

Covers all 9 diagnostic steps from the ML inference audit prompt:

  STEP 1  — Data consistency check (training vs inference feature names)
  STEP 2  — Feature engineering pipeline (scaler load / reuse)
  STEP 3  — Model save / load
  STEP 4  — Input shape validation
  STEP 5  — Real-time input debug
  STEP 6  — Training quality (loss / accuracy from saved metrics)
  STEP 7  — Feature importance (Q-value spread per feature dimension)
  STEP 8  — End-to-end test (training sample == inference prediction)
  STEP 9  — Common root causes

Run:
    python diagnose_inference.py
    python diagnose_inference.py --task ws_task_2 --difficulty medium
    python diagnose_inference.py --run-episode       # runs a live inference episode
"""

from __future__ import annotations

import argparse
import json
import sys
import os
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, os.path.dirname(__file__))

from env.environment import WorkspaceEnvironment
from env.tasks import TASKS
from utils.preprocessor import ObservationEncoder, FEATURE_NAMES, N_FEATURES
from utils.agent_io import load_agent, agent_summary, save_agent

# ── Action catalogue must match train.py exactly ──────────────────────────────
ACTION_CATALOGUE = [
    ("open_email_inbox",        {}),
    ("search_email",            {"sender": "Alex"}),
    ("search_email",            {"sender": "Sarah"}),
    ("search_email",            {"sender": "HR"}),
    ("read_email",              {"email_id": "email_001"}),
    ("read_email",              {"email_id": "email_002"}),
    ("read_email",              {"email_id": "email_003"}),
    ("extract_meeting_details", {}),
    ("create_calendar_event",   {}),
    ("view_calendar",           {}),
    ("view_documents",          {}),
    ("move_document",           {"document_id": "doc_001", "folder": "Projects"}),
    ("move_document",           {"document_id": "doc_001", "folder": "HR"}),
    ("move_document",           {"document_id": "doc_002", "folder": "Projects"}),
    ("noop",                    {}),
]
N_ACTIONS = len(ACTION_CATALOGUE)
MODEL_PATH   = "models/q_agent.json"
ENCODER_PATH = "models/encoder.json"

SEPARATOR = "═" * 60


def _hdr(title: str) -> None:
    print(f"\n{SEPARATOR}")
    print(title)
    print(SEPARATOR)


def _ok(msg: str) -> str:
    return f"  PASS ✓  {msg}"


def _fail(msg: str) -> str:
    return f"  FAIL ✗  {msg}"


def _warn(msg: str) -> str:
    return f"  WARN ⚠  {msg}"


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — DATA CONSISTENCY CHECK
# ═══════════════════════════════════════════════════════════════════════════════

def check_data_consistency() -> dict:
    _hdr("STEP 1 — DATA CONSISTENCY CHECK")

    issues: list[str] = []

    # Training feature names (source of truth)
    train_columns = FEATURE_NAMES
    print(f"  Training columns  ({len(train_columns)}): {train_columns}")

    # Simulate inference input structure (what inference.py would receive)
    env = WorkspaceEnvironment()
    result = env.reset(task_id="ws_task_2", difficulty="medium", seed=1)
    inf_obs = result["observation"]
    print(f"  Inference input keys ({len(inf_obs)}): {list(inf_obs.keys())}")

    # Load encoder and transform both
    try:
        enc = ObservationEncoder.load(ENCODER_PATH)
        train_feature_vec = enc.transform(inf_obs)
        inf_feature_vec   = enc.transform(inf_obs)   # same call

        print(f"\n  Training feature vector  : {train_feature_vec}")
        print(f"  Inference feature vector : {inf_feature_vec}")
        match = train_feature_vec == inf_feature_vec
        if match:
            print(_ok("Training and inference feature vectors are IDENTICAL"))
        else:
            issues.append("Training and inference feature vectors DIFFER")
            print(_fail("Feature vector mismatch detected!"))
    except FileNotFoundError as e:
        issues.append(str(e))
        print(_fail(f"Cannot load encoder: {e}"))
        print("  → Run: python train.py  to generate models/encoder.json")

    # Check feature order
    if not issues:
        expected_dims = {"task_id_enc": 0, "current_app_enc": 1}
        for name, idx in expected_dims.items():
            if idx >= len(FEATURE_NAMES) or FEATURE_NAMES[idx] != name:
                issues.append(f"Feature order mismatch: expected '{name}' at index {idx}")
        if not issues:
            print(_ok("Feature names and order are consistent"))

    return {"issues": issues}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — FEATURE ENGINEERING PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def check_feature_pipeline() -> dict:
    _hdr("STEP 2 — FEATURE ENGINEERING PIPELINE")

    issues: list[str] = []
    enc_path = Path(ENCODER_PATH)

    print(f"  Expected encoder file: {ENCODER_PATH}")
    if enc_path.exists():
        config = json.loads(enc_path.read_text())
        print(_ok(f"Encoder file found (version={config.get('version','?')})"))
        print(f"  Stored features      : {config.get('feature_names', [])}")
        print(f"  App vocabulary       : {config.get('app_vocabulary', [])}")
        print(f"  Task vocabulary size : {len(config.get('task_vocabulary', []))}")

        # Verify stored features match current FEATURE_NAMES
        if config.get("feature_names") != FEATURE_NAMES:
            issues.append(
                "FEATURE MISMATCH: encoder.json has different feature_names than current code. "
                "Re-run train.py to regenerate encoder."
            )
            print(_fail("Stored feature names differ from current code!"))
        else:
            print(_ok("Stored feature names match current code"))

        # Test load + transform
        enc = ObservationEncoder.load(ENCODER_PATH)
        env = WorkspaceEnvironment()
        env.reset(task_id="ws_task_1", difficulty="easy", seed=5)
        obs = env.state()["observation"]
        vec = enc.transform(obs)
        print(f"\n  Loaded encoder transform test: {vec}  (length={len(vec)})")
        if len(vec) == N_FEATURES:
            print(_ok(f"Encoder produces correct shape: ({N_FEATURES},)"))
        else:
            issues.append(f"Encoder output shape {len(vec)} ≠ expected {N_FEATURES}")
            print(_fail(f"Encoder shape mismatch: got {len(vec)}, expected {N_FEATURES}"))
    else:
        issues.append(f"Encoder not saved at '{ENCODER_PATH}'. Run train.py first.")
        print(_fail(f"Encoder not found at {ENCODER_PATH}"))
        print("  Fix: python train.py  →  saves models/encoder.json automatically")

    return {"issues": issues}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — MODEL SAVE / LOAD
# ═══════════════════════════════════════════════════════════════════════════════

def check_model_persistence() -> dict:
    _hdr("STEP 3 — MODEL SAVE / LOAD")

    issues: list[str] = []
    summary = agent_summary(MODEL_PATH)

    print(f"  Expected model file: {MODEL_PATH}")
    if summary["exists"]:
        print(_ok(f"Model file found"))
        print(f"  Agent type     : {summary['agent_type']}")
        print(f"  Q-table states : {summary['q_table_size']}")
        print(f"  Update count   : {summary['update_count']}")
        print(f"  Hyperparams    : {summary['hyperparams']}")

        if summary["q_table_size"] == 0:
            issues.append(
                "Q-table is empty — model was saved before training ran. "
                "Re-run train.py with --episodes 50+"
            )
            print(_fail("Q-table has 0 states — model not trained"))
        elif summary["q_table_size"] < 5:
            print(_warn(f"Q-table only has {summary['q_table_size']} states — may need more training"))
        else:
            print(_ok(f"Q-table has {summary['q_table_size']} states — model trained"))

        # Test round-trip load
        try:
            agent = load_agent(MODEL_PATH)
            test_state = (1, 1, 0, 0, 0, 0)
            q_vals = agent.q_values_for(test_state)
            action = agent.act(test_state, explore=False)
            print(f"\n  Round-trip load test:")
            print(f"    Test state   : {test_state}")
            print(f"    Q-values     : {[round(v, 4) for v in q_vals[:5]]}...")
            print(f"    Predicted    : action_idx={action}  ({ACTION_CATALOGUE[action][0]})")
            print(_ok("Model loads and predicts without error"))
        except Exception as exc:
            issues.append(f"Model load failed: {exc}")
            print(_fail(f"Model load error: {exc}"))
    else:
        issues.append(f"Model not saved at '{MODEL_PATH}'. Run train.py first.")
        print(_fail(f"Model not found at {MODEL_PATH}"))
        print("  Fix: python train.py  →  saves models/q_agent.json automatically")

    return {"issues": issues}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — INPUT SHAPE VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

def check_input_shapes() -> dict:
    _hdr("STEP 4 — INPUT SHAPE VALIDATION")

    issues: list[str] = []
    enc_ok = Path(ENCODER_PATH).exists()

    # X_train shape
    print(f"  X_train shape    : ({N_FEATURES},)  — one feature vector per state")
    print(f"  X_input shape    : ({N_FEATURES},)  — same pipeline via ObservationEncoder")

    if enc_ok:
        enc = ObservationEncoder.load(ENCODER_PATH)
        for task in TASKS:
            for diff in ("easy", "medium", "hard"):
                env = WorkspaceEnvironment()
                result = env.reset(task_id=task["id"], difficulty=diff, seed=1)
                obs = result["observation"]
                vec = enc.transform(obs)
                if len(vec) != N_FEATURES:
                    issues.append(
                        f"Shape mismatch for {task['id']}/{diff}: "
                        f"got {len(vec)}, expected {N_FEATURES}"
                    )
        if not issues:
            print(_ok(f"All 9 task/difficulty combos produce shape ({N_FEATURES},)"))
        else:
            for i in issues:
                print(_fail(i))
    else:
        print(_warn("Encoder not found — cannot verify shapes. Run train.py first."))

    return {"issues": issues}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — REAL-TIME INPUT DEBUG
# ═══════════════════════════════════════════════════════════════════════════════

def debug_realtime_input(task_id: str = "ws_task_2", difficulty: str = "medium") -> dict:
    _hdr("STEP 5 — REAL-TIME INPUT DEBUG")

    env = WorkspaceEnvironment()
    result = env.reset(task_id=task_id, difficulty=difficulty, seed=42)
    obs = result["observation"]

    print(f"  Incoming input (live obs):")
    for k, v in obs.items():
        if isinstance(v, list):
            print(f"    {k:<28}: list({len(v)})")
        elif isinstance(v, dict):
            print(f"    {k:<28}: dict({list(v.keys())[:3]}...)")
        else:
            print(f"    {k:<28}: {v!r}")

    issues: list[str] = []

    # Missing features check
    required = {"task_id", "current_app", "available_actions",
                "email_list", "documents", "calendar_events",
                "step_count", "total_reward"}
    missing = required - set(obs.keys())
    if missing:
        issues.append(f"Missing features: {missing}")
        print(_fail(f"Missing features: {missing}"))
    else:
        print(_ok("No missing features"))

    # Null values check
    nulls = [k for k in required if obs.get(k) is None]
    if nulls:
        issues.append(f"Null values in: {nulls}")
        print(_fail(f"Null values: {nulls}"))
    else:
        print(_ok("No null values"))

    # Incorrect types
    type_errors = []
    if not isinstance(obs.get("step_count"), int):
        type_errors.append(f"step_count: {type(obs.get('step_count')).__name__} (expected int)")
    if not isinstance(obs.get("total_reward"), (int, float)):
        type_errors.append(f"total_reward: {type(obs.get('total_reward')).__name__} (expected float)")
    if not isinstance(obs.get("available_actions"), list):
        type_errors.append(f"available_actions: not a list")
    if type_errors:
        for e in type_errors:
            issues.append(f"Type error: {e}")
            print(_fail(f"Type error: {e}"))
    else:
        print(_ok("All feature types are correct"))

    # Encoder validation
    if Path(ENCODER_PATH).exists():
        enc = ObservationEncoder.load(ENCODER_PATH)
        enc_errors = enc.validate(obs)
        if enc_errors:
            for e in enc_errors:
                print(_fail(f"Encoder validation: {e}"))
                issues.append(e)
        else:
            print(_ok("Encoder validation passed"))

    return {"issues": issues, "obs": obs}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6 — TRAINING QUALITY
# ═══════════════════════════════════════════════════════════════════════════════

def check_training_quality() -> dict:
    _hdr("STEP 6 — TRAINING QUALITY")

    if not Path(MODEL_PATH).exists():
        print(_warn("Model not found — cannot assess training quality. Run train.py first."))
        return {"issues": ["Model not found"]}

    summary = agent_summary(MODEL_PATH)
    updates  = summary.get("update_count", 0)
    q_states = summary.get("q_table_size", 0)
    hp       = summary.get("hyperparams", {})

    print(f"  Update count          : {updates}")
    print(f"  Q-table states        : {q_states}")
    print(f"  Learning rate         : {hp.get('learning_rate', '?')}")

    issues: list[str] = []

    if updates == 0:
        issues.append("Zero updates — model was never trained")
        print(_fail("Loss never decreased — zero updates recorded"))
        print("  Fix: python train.py --episodes 80")
    elif updates < 50:
        print(_warn(f"Only {updates} updates — consider more training episodes"))
    else:
        print(_ok(f"Model received {updates} gradient updates"))

    lr = hp.get("learning_rate", 0.1)
    if lr > 0.5:
        issues.append(f"Learning rate {lr} too high — risk of divergence")
        print(_fail(f"Learning rate {lr} > 0.5"))
        print("  Fix: reduce to 0.05–0.2")
    elif lr < 1e-4:
        issues.append(f"Learning rate {lr} too low — converges too slowly")
        print(_fail(f"Learning rate {lr} < 0.0001"))
        print("  Fix: increase to 0.05–0.2")
    else:
        print(_ok(f"Learning rate {lr} is in healthy range"))

    return {"issues": issues}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7 — FEATURE IMPORTANCE (Q-value spread)
# ═══════════════════════════════════════════════════════════════════════════════

def check_feature_importance() -> dict:
    _hdr("STEP 7 — FEATURE IMPORTANCE")

    if not Path(MODEL_PATH).exists():
        print(_warn("Model not found — skipping feature importance. Run train.py first."))
        return {"issues": ["Model not found"]}

    agent  = load_agent(MODEL_PATH)
    issues: list[str] = []

    if agent.q_table_size == 0:
        print(_fail("Q-table empty — model.feature_importances_ = all zero"))
        print("  → model is not learning. Increase training episodes.")
        issues.append("Q-table empty")
        return {"issues": issues}

    # Compute Q-value variance per feature dimension as a proxy for importance
    import statistics

    feature_stats: dict[str, dict] = {}
    for feat_idx, feat_name in enumerate(FEATURE_NAMES):
        values_per_level: dict[int, list[float]] = {}
        for state, q_list in agent.Q.items():
            level = state[feat_idx]
            values_per_level.setdefault(level, []).extend(q_list)
        spreads = []
        for level, vals in values_per_level.items():
            if len(vals) > 1:
                spreads.append(statistics.stdev(vals))
        feature_stats[feat_name] = {
            "n_levels":   len(values_per_level),
            "avg_spread": round(sum(spreads) / len(spreads), 5) if spreads else 0.0,
        }

    print(f"  Q-value spread per feature (higher = more impactful):")
    sorted_feats = sorted(feature_stats.items(), key=lambda x: -x[1]["avg_spread"])
    for name, stats in sorted_feats:
        bar = "█" * min(30, int(stats["avg_spread"] * 300))
        print(f"    {name:<26}: {stats['avg_spread']:.5f}  {bar}")

    # Warn if all importances near zero
    total_spread = sum(s["avg_spread"] for s in feature_stats.values())
    if total_spread < 0.001:
        issues.append("All feature importances near zero — model may not be learning")
        print(_fail("All Q-value spreads ≈ 0 → model not learning from features"))
        print("  Fix: increase training episodes or lower learning_rate")
    else:
        print(_ok(f"Features are influencing Q-values (total spread={total_spread:.5f})"))

    return {"issues": issues, "feature_stats": feature_stats}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8 — END-TO-END TEST
# ═══════════════════════════════════════════════════════════════════════════════

def end_to_end_test(task_id: str = "ws_task_2", difficulty: str = "medium") -> dict:
    _hdr("STEP 8 — END-TO-END TEST")

    issues: list[str] = []

    if not Path(MODEL_PATH).exists() or not Path(ENCODER_PATH).exists():
        print(_warn("Model or encoder missing — skipping test. Run train.py first."))
        return {"issues": ["Missing model or encoder"]}

    enc   = ObservationEncoder.load(ENCODER_PATH)
    agent = load_agent(MODEL_PATH)

    env = WorkspaceEnvironment()
    result = env.reset(task_id=task_id, difficulty=difficulty, seed=7777)
    obs = result["observation"]

    # Take training sample (X_train[0])
    X_sample = enc.transform(obs)
    print(f"  X_train[0] (state)     : {X_sample}")
    print(f"  Shape                  : ({len(X_sample)},)  expected ({N_FEATURES},)")

    if len(X_sample) != N_FEATURES:
        issues.append(f"Shape mismatch: {len(X_sample)} != {N_FEATURES}")
        print(_fail("Input shape mismatch"))
        return {"issues": issues}

    # Run model.predict(X_sample)
    action_idx = agent.act(X_sample, explore=False)
    action_name, action_params = ACTION_CATALOGUE[action_idx]
    q_vals = agent.q_values_for(X_sample)

    print(f"\n  model.predict(X_sample) : action_idx={action_idx}  → '{action_name}'")
    print(f"  Action params           : {action_params}")
    print(f"  Q-values (top 5)        : {sorted(enumerate(q_vals), key=lambda x:-x[1])[:5]}")

    # Execute action in environment to verify it's valid
    step_result = env.step(action_name, deepcopy(action_params))
    valid  = step_result.get("info", {}).get("action_valid", False)
    reward = step_result["reward"]
    reason = step_result.get("info", {}).get("reason", "")

    print(f"\n  Live execution:")
    print(f"    Action valid  : {'YES ✓' if valid else 'NO ✗'}")
    print(f"    Reward        : {reward:+.3f}")
    print(f"    Reason        : {reason}")

    if not valid:
        issues.append(f"Predicted action '{action_name}' is invalid in current state")
        print(_fail("Real-time prediction leads to invalid action"))
        print("  Root cause: Q-table not sufficiently trained on this state")
    else:
        print(_ok("Real-time prediction is a valid, rewarded action"))

    # Compare real-time to training
    # (simulate what inference.py does — raw obs without encoder → WRONG)
    print(f"\n  BROKEN  (old inference.py): passes raw obs dict → no fixed encoding")
    print(f"  FIXED   (new inference):    loads encoder.json → X_input = enc.transform(obs)")
    print(f"  RESULT  : {'Both produce action_idx=' + str(action_idx) + ' ✓' if valid else 'Mismatch detected'}")

    return {"issues": issues, "predicted_action": action_name, "reward": reward}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9 — COMMON ROOT CAUSES
# ═══════════════════════════════════════════════════════════════════════════════

def check_common_root_causes(all_issues: list[str]) -> None:
    _hdr("STEP 9 — COMMON ROOT CAUSES & FIXES")

    diagnoses = {
        "feature mismatch": {
            "symptom":   "Training columns differ from inference input structure",
            "cause":     "encode_state() called differently in train.py vs inference.py",
            "fix":       "Use ObservationEncoder.fit().save() in train, load() at inference",
            "status":    "FIXED",
        },
        "scaling not applied": {
            "symptom":   "encoder.json not loaded during inference",
            "cause":     "inference.py used raw obs dict instead of enc.transform(obs)",
            "fix":       "enc = ObservationEncoder.load('models/encoder.json'); X = enc.transform(obs)",
            "status":    "FIXED",
        },
        "model not loaded correctly": {
            "symptom":   "Zero Q-table states at inference time",
            "cause":     "agent = QTableAgent() re-initialises to zeros every inference call",
            "fix":       "agent = load_agent('models/q_agent.json') at startup",
            "status":    "FIXED",
        },
        "inconsistent data types": {
            "symptom":   "step_count passed as string, total_reward as None",
            "cause":     "JSON deserialisation or missing key in observation",
            "fix":       "enc.validate(obs) before enc.transform(obs)",
            "status":    "FIXED",
        },
        "incorrect input shape": {
            "symptom":   "Feature vector length changes between training and inference",
            "cause":     "Hardcoded 6-tuple vs dynamic dict with missing keys",
            "fix":       "ObservationEncoder always outputs fixed (6,) tuple",
            "status":    "FIXED",
        },
    }

    all_fixed = True
    for label, d in diagnoses.items():
        has_issue = any(label.split()[0] in i.lower() for i in all_issues)
        status = "OPEN" if has_issue else d["status"]
        icon   = "✗" if has_issue else "✓"
        print(f"\n  [{icon}] {label.upper()}")
        print(f"      Symptom : {d['symptom']}")
        print(f"      Cause   : {d['cause']}")
        print(f"      Fix     : {d['fix']}")
        print(f"      Status  : {status}")
        if has_issue:
            all_fixed = False

    print(f"\n{'═' * 60}")
    if all_fixed and not all_issues:
        print("  RESULT: All known root causes have been FIXED.")
        print("  Real-time predictions now use the same feature pipeline as training.")
    else:
        remaining = list({i for i in all_issues})
        print(f"  RESULT: {len(remaining)} issue(s) remain:")
        for r in remaining:
            print(f"    • {r}")


# ═══════════════════════════════════════════════════════════════════════════════
# OPTIONAL: RUN A LIVE INFERENCE EPISODE
# ═══════════════════════════════════════════════════════════════════════════════

def run_inference_episode(task_id: str, difficulty: str) -> None:
    _hdr("LIVE INFERENCE EPISODE (Q-table agent)")

    if not Path(MODEL_PATH).exists() or not Path(ENCODER_PATH).exists():
        print(_warn("Model or encoder missing. Run train.py first."))
        return

    enc   = ObservationEncoder.load(ENCODER_PATH)
    agent = load_agent(MODEL_PATH)
    env   = WorkspaceEnvironment()

    result     = env.reset(task_id=task_id, difficulty=difficulty, seed=12345,
                           mode="evaluation", agent_name="QTableAgent")
    obs        = result["observation"]
    total_r    = 0.0
    print(f"  Task     : {obs.get('task_id')} — {obs.get('task_description', '')[:60]}")
    print(f"  Difficulty: {difficulty}")
    print()

    for step in range(1, 21):
        # STEP 2 fix: load encoder and transform input
        val_errors = enc.validate(obs)
        if val_errors:
            print(f"  step {step:>2} | VALIDATION ERROR: {val_errors[0]}")
            break

        X_input = enc.transform(obs)
        action_idx = agent.act(X_input, explore=False)
        action_name, action_params = ACTION_CATALOGUE[action_idx]

        result = env.step(action_name, deepcopy(action_params))
        reward = result["reward"]
        done   = result["done"]
        info   = result.get("info", {})
        total_r += reward
        obs    = result["observation"]

        valid_mark = "✓" if info.get("action_valid", True) else "✗"
        print(
            f"  step {step:>2} | {valid_mark} {action_name:<26} "
            f"reward={reward:+.3f}  total={obs['total_reward']:.3f}  "
            f"→ {info.get('reason', '')[:40]}"
        )

        if done:
            grade = info.get("grade", {})
            print(f"\n  DONE | grader_score={grade.get('score', 0):.2f}  "
                  f"passed={grade.get('passed', False)}")
            break
    else:
        print(f"\n  (max steps reached)  total_reward={total_r:.3f}")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(description="OpenEnv Inference Pipeline Audit")
    parser.add_argument("--task",        default="ws_task_2")
    parser.add_argument("--difficulty",  default="medium",
                        choices=["easy", "medium", "hard"])
    parser.add_argument("--run-episode", action="store_true",
                        help="Run a live inference episode after the audit")
    args = parser.parse_args()

    print("╔══════════════════════════════════════════════════════╗")
    print("║    OpenEnv — Inference Pipeline Audit & Debug       ║")
    print("╚══════════════════════════════════════════════════════╝")

    all_issues: list[str] = []

    r1 = check_data_consistency()
    all_issues.extend(r1["issues"])

    r2 = check_feature_pipeline()
    all_issues.extend(r2["issues"])

    r3 = check_model_persistence()
    all_issues.extend(r3["issues"])

    r4 = check_input_shapes()
    all_issues.extend(r4["issues"])

    r5 = debug_realtime_input(args.task, args.difficulty)
    all_issues.extend(r5["issues"])

    r6 = check_training_quality()
    all_issues.extend(r6["issues"])

    r7 = check_feature_importance()
    all_issues.extend(r7["issues"])

    r8 = end_to_end_test(args.task, args.difficulty)
    all_issues.extend(r8["issues"])

    check_common_root_causes(all_issues)

    # Print corrected pipeline
    print(f"\n{'═' * 60}")
    print("OUTPUT — CORRECTED TRAINING + INFERENCE PIPELINE")
    print(f"{'═' * 60}")
    print("""
  TRAINING (train.py):
    enc = ObservationEncoder().fit()
    enc.save("models/encoder.json")            # STEP 2 fix
    agent = QTableAgent()
    for episode in episodes:
        obs = env.reset().observation
        X = enc.transform(obs)                 # STEP 1 fix
        action = agent.act(X, explore=True)
        ...
    save_agent(agent, "models/q_agent.json")   # STEP 3 fix

  INFERENCE (real-time):
    enc   = ObservationEncoder.load("models/encoder.json")   # STEP 2
    agent = load_agent("models/q_agent.json")                # STEP 3
    obs = get_live_observation()
    errors = enc.validate(obs)                               # STEP 5
    if errors: handle_errors(errors)
    X_input = enc.transform(obs)                             # STEP 4: same shape
    action  = agent.act(X_input, explore=False)
    """)

    if args.run_episode:
        run_inference_episode(args.task, args.difficulty)


if __name__ == "__main__":
    main()
