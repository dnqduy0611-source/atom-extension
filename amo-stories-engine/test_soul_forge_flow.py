"""Manual test: Full Soul Forge flow via API."""
import requests
import time
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE = "http://localhost:8001/api/soul-forge"
USER_ID = f"test-flow-{int(time.time())}"

def test_full_flow():
    print("=" * 60)
    print("SOUL FORGE — Full Flow Test")
    print("=" * 60)
    
    # 1. START
    print("\n--- STEP 1: Start Session ---")
    r = requests.post(f"{BASE}/start", json={"user_id": USER_ID})
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"ERROR: {r.text}")
        return
    data = r.json()
    session_id = data["session_id"]
    scene = data["scene"]
    print(f"Session: {session_id}")
    print(f"Scene {scene['scene_id']}: {scene.get('title', 'N/A')}")
    print(f"Phase: {scene['phase']}")
    print(f"Text: {scene['text'][:80]}...")
    print(f"Choices: {len(scene.get('choices', []))}")
    for c in scene.get("choices", []):
        print(f"  [{c['index']}] {c['text'][:50]}")
    
    # 2. CHOICE Scene 1 → Scene 2
    print("\n--- STEP 2: Choice Scene 1 (index=0) ---")
    r = requests.post(f"{BASE}/choice", json={
        "session_id": session_id,
        "choice_index": 0,
        "response_time_ms": 3500,
        "hover_count": 2,
    })
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"ERROR: {r.text}")
        return
    scene = r.json()["scene"]
    print(f"Scene {scene['scene_id']}: {scene.get('title', 'N/A')}")
    print(f"Phase: {scene['phase']}")
    print(f"Text: {scene['text'][:80]}...")
    print(f"Choices: {len(scene.get('choices', []))}")
    for c in scene.get("choices", []):
        print(f"  [{c['index']}] {c['text'][:50]}")
    
    # 3. CHOICE Scene 2 → Scene 3
    print("\n--- STEP 3: Choice Scene 2 (index=1) ---")
    r = requests.post(f"{BASE}/choice", json={
        "session_id": session_id,
        "choice_index": 1,
        "response_time_ms": 5000,
        "hover_count": 3,
    })
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"ERROR: {r.text}")
        return
    scene = r.json()["scene"]
    print(f"Scene {scene['scene_id']}: {scene.get('title', 'N/A')}")
    print(f"Phase: {scene['phase']}")
    print(f"Choices: {len(scene.get('choices', []))}")
    
    # 4. CHOICE Scene 3 → Scene 4
    print("\n--- STEP 4: Choice Scene 3 (index=0) ---")
    r = requests.post(f"{BASE}/choice", json={
        "session_id": session_id,
        "choice_index": 0,
        "response_time_ms": 4200,
        "hover_count": 1,
    })
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"ERROR: {r.text}")
        return
    scene = r.json()["scene"]
    print(f"Scene {scene['scene_id']}: {scene.get('title', 'N/A')}")
    print(f"Phase: {scene['phase']}")
    print(f"Choices: {len(scene.get('choices', []))}")
    
    # 5. CHOICE Scene 4 → Scene 5
    print("\n--- STEP 5: Choice Scene 4 (index=2) ---")
    r = requests.post(f"{BASE}/choice", json={
        "session_id": session_id,
        "choice_index": 2,
        "response_time_ms": 7000,
        "hover_count": 4,
    })
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"ERROR: {r.text}")
        return
    scene = r.json()["scene"]
    print(f"Scene {scene['scene_id']}: {scene.get('title', 'N/A')}")
    print(f"Phase: {scene['phase']}")
    print(f"Choices: {len(scene.get('choices', []))}")
    
    # 6. ADVANCE past Scene 5
    print("\n--- STEP 6: Advance past Scene 5 ---")
    r = requests.post(f"{BASE}/advance", json={"user_id": USER_ID})
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"ERROR: {r.text}")
        return
    scene = r.json()["scene"]
    print(f"Phase: {scene['phase']}")
    print(f"Text: {scene.get('text', 'N/A')[:80]}...")
    
    # 7. FRAGMENT
    print("\n--- STEP 7: Submit Soul Fragment ---")
    r = requests.post(f"{BASE}/fragment", json={
        "session_id": session_id,
        "text": "Gia dinh toi - nhung nguoi toi yeu thuong nhat",
        "typing_time_ms": 12000,
        "revision_count": 2,
    })
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"ERROR: {r.text}")
        return
    scene = r.json()["scene"]
    print(f"Phase: {scene['phase']}")
    
    # 8. FORGE
    print("\n--- STEP 8: Forge Skill ---")
    r = requests.post(f"{BASE}/forge", json={
        "session_id": session_id,
        "name": "Nguoi Thu Nghiem",
    })
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"ERROR: {r.text}")
        return
    result = r.json()
    print(f"Player ID: {result['player_id']}")
    print(f"Skill: {result['skill_name']}")
    print(f"Description: {result['skill_description']}")
    print(f"Category: {result['skill_category']}")
    print(f"Soul Resonance: {result.get('soul_resonance', 'N/A')}")
    print(f"Archetype: {result['archetype']} ({result['archetype_display']})")
    print(f"DNA: {result['dna_affinity']}")
    
    print("\n" + "=" * 60)
    print("ALL STEPS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    test_full_flow()
