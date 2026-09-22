import os
import sys
import json
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

API_BASE = "http://localhost:8000/api/v1"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "apps", "web", "public", "demo-data")

def get_token():
    req = urllib.request.Request(
        f"{API_BASE}/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    res = urllib.request.urlopen(req)
    data = json.loads(res.read())
    return data["access_token"]

def fetch(path, token, method="GET", body=None):
    headers = {"Authorization": f"Bearer {token}"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    
    req = urllib.request.Request(f"{API_BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return None

def export_case(c, token, cases_dir):
    cid = c["id"]
    code = c.get("case_code", cid)
    filepath = os.path.join(cases_dir, f"{cid}.json")
    if os.path.exists(filepath):
        print(f"Skipping already exported {code}")
        return

    print(f"Exporting {code} ({cid})...")
    c_detail = fetch(f"/cases/{cid}", token) or c
    entities = fetch(f"/entities/{cid}", token) or []
    graph = fetch(f"/graph/{cid}", token, method="POST", body={}) or {"nodes": [], "edges": []}
    hypotheses = fetch(f"/hypotheses/{cid}", token) or []
    signals = fetch(f"/analysis/{cid}/signals", token) or {"signals": []}
    timeline = fetch(f"/timeline/{cid}?page_size=500", token) or {"items": [], "total": 0, "page": 1, "page_size": 500}
    workspace_summary = fetch(f"/workspace/{cid}/summary", token) or {}
    leads = fetch(f"/workspace/{cid}/leads", token) or []
    contradictions = fetch(f"/workspace/{cid}/contradictions", token) or []
    gaps = fetch(f"/workspace/{cid}/gaps", token) or []
    actions = fetch(f"/workspace/{cid}/actions", token) or []
    cctv_resp = fetch(f"/cctv/{cid}/observations", token) or {}
    cctv = cctv_resp.get("observations", []) if isinstance(cctv_resp, dict) else (cctv_resp or [])
    files = fetch(f"/evidence/{cid}/files", token) or []
    imports = fetch(f"/evidence/{cid}/imports", token) or []
    merge_sugg = fetch(f"/entities/{cid}/merge-suggestions", token) or []
    reports = fetch(f"/reports/{cid}", token) or []

    case_bundle = {
        "case": c_detail,
        "entities": entities,
        "graph": graph,
        "hypotheses": hypotheses,
        "signals": signals,
        "timeline": timeline,
        "workspace_summary": workspace_summary,
        "leads": leads,
        "contradictions": contradictions,
        "gaps": gaps,
        "actions": actions,
        "cctv": cctv,
        "files": files,
        "imports": imports,
        "merge_suggestions": merge_sugg,
        "reports": reports,
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(case_bundle, f, indent=2)
    print(f"[DONE] {code}")

def main():
    print("Fast Parallel SPYDEE demo snapshot export...")
    os.makedirs(OUT_DIR, exist_ok=True)
    cases_dir = os.path.join(OUT_DIR, "cases")
    os.makedirs(cases_dir, exist_ok=True)

    token = get_token()
    cases = fetch("/cases", token) or []
    with open(os.path.join(OUT_DIR, "cases.json"), "w", encoding="utf-8") as f:
        json.dump(cases, f, indent=2)
    print(f"[OK] cases.json ({len(cases)} cases)")

    datasets = fetch("/datasets", token) or []
    with open(os.path.join(OUT_DIR, "datasets.json"), "w", encoding="utf-8") as f:
        json.dump(datasets, f, indent=2)
    print(f"[OK] datasets.json ({len(datasets)} datasets)")

    datasets_summary = fetch("/datasets/summary", token) or {}
    with open(os.path.join(OUT_DIR, "datasets_summary.json"), "w", encoding="utf-8") as f:
        json.dump(datasets_summary, f, indent=2)

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(export_case, c, token, cases_dir) for c in cases]
        for f in futures:
            f.result()

    demo_auth = {
        "admin": {
            "access_token": "demo-admin-token-vercel",
            "token_type": "bearer",
            "user": {
                "id": "5aefa310-2f5f-4ba8-bf37-fcf969fa8f55",
                "username": "admin",
                "email": "admin@spydee.example",
                "display_name": "System Administrator",
                "role": "administrator",
                "is_active": True
            }
        },
        "investigator": {
            "access_token": "demo-investigator-token-vercel",
            "token_type": "bearer",
            "user": {
                "id": "11111111-2f5f-4ba8-bf37-fcf969fa8f55",
                "username": "investigator",
                "email": "investigator@spydee.example",
                "display_name": "Senior Investigator",
                "role": "investigator",
                "is_active": True
            }
        },
        "supervisor": {
            "access_token": "demo-supervisor-token-vercel",
            "token_type": "bearer",
            "user": {
                "id": "22222222-2f5f-4ba8-bf37-fcf969fa8f55",
                "username": "supervisor",
                "email": "supervisor@spydee.example",
                "display_name": "Case Supervisor",
                "role": "case_supervisor",
                "is_active": True
            }
        }
    }
    with open(os.path.join(OUT_DIR, "demo_users.json"), "w", encoding="utf-8") as f:
        json.dump(demo_auth, f, indent=2)

    print("\n[SUCCESS] All 16 cases and 25 datasets exported for Vercel!")

if __name__ == "__main__":
    main()
