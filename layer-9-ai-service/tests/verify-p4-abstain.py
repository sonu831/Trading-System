"""
PHASE 0 P4 verification: /api/v1/predict must NEVER return a numeric prediction
while no trained weights exist. Structural checks on source files.
"""
import os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passing = 0
failing = 0

def ok(label, cond, detail=""):
    global passing, failing
    if cond: passing += 1; print(f"  PASS  {label}")
    else: failing += 1; print(f"  FAIL  {label} {detail}")

print("=" * 60)
print("PHASE 0 P4: No fabricated predictions")
print("=" * 60)

# Test 1: PyTorchEngine returns None, not 0.65
with open(os.path.join(BASE, 'app', 'engines', 'pytorch_engine.py'), encoding='utf-8') as f:
    py_src = f.read()
ok("PyTorchEngine returns prediction=None (not 0.65)",
   'prediction=None' in py_src and '0.65' not in py_src)
ok("PyTorchEngine returns confidence=None",
   'confidence=None' in py_src)
ok("PyTorchEngine returns status='not_trained'",
   '\"not_trained\"' in py_src.replace("'", '"'))

# Test 2: PredictionResult has null-safe fields
with open(os.path.join(BASE, 'app', 'core', 'engine.py'), encoding='utf-8') as f:
    eng_src = f.read()
ok("PredictionResult has Optional[float] prediction",
   'Optional[float]' in eng_src)
ok("PredictionResult has status field",
   'status: str' in eng_src)

# Test 3: L9 main.py passes status through response
with open(os.path.join(BASE, 'app', 'main.py'), encoding='utf-8') as f:
    main_src = f.read()
ok("PredictionResponse has Optional[float] prediction",
   "Optional[float]" in main_src)
ok("L9 passes status field in response",
   '"status"' in main_src and 'getattr(result' in main_src.replace(" ", ""))

# Test 4: Heuristic still returns ok (not broken)
with open(os.path.join(BASE, 'app', 'engines', 'heuristic.py'), encoding='utf-8') as f:
    heu_src = f.read()
ok("HeuristicEngine returns status='ok'",
   '"ok"' in heu_src.replace("'", '"'))
ok("HeuristicEngine returns numeric prediction",
   'prediction=prob' in heu_src)

# Test 5: Frontend hides abstain/not_trained
fe_path = os.path.join(
    BASE, '..', 'layer-8-presentation-notification', 'stock-analysis-portal',
    'src', 'pages', 'predictions.tsx'
)
if os.path.exists(fe_path):
    with open(fe_path, encoding='utf-8') as f:
        fe_src = f.read()
    # Check the combined condition: status !== 'abstain' && status !== 'not_trained'
    has_abstain = "status !== 'abstain'" in fe_src
    has_not_trained = "status !== 'not_trained'" in fe_src
    ok("Frontend checks for abstain + not_trained status",
       has_abstain and has_not_trained,
       f"abstain={has_abstain} not_trained={has_not_trained}")
else:
    ok("Frontend predictions page found", False, fe_path)

print(f"\n  {passing} passed, {failing} failed")
if failing == 0:
    print("  PHASE 0 P4 VERIFIED — no fabricated prediction reaches UI")
else:
    print("  PHASE 0 P4 FAILED — fix the failing checks above")
sys.exit(0 if failing == 0 else 1)
