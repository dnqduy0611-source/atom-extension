"""
Amoisekai — Veo Video Generator
================================
Tạo video từ prompt bằng Google Veo 3.1 API.
Video sẽ lưu vào thư mục branding/videos/

Cách dùng:
    # Tạo 1 video từ prompt trực tiếp:
    python generate_video.py --prompt "Cinematic dark fantasy scene..."

    # Tạo video từ prompt có sẵn trong visual_world_bible (theo tên):
    python generate_video.py --preset vanguard

    # Dùng model nhanh hơn (chất lượng thấp hơn):
    python generate_video.py --preset vanguard --fast

    # Đặt tên file output:
    python generate_video.py --preset vanguard --output vanguard_hero.mp4

Yêu cầu:
    pip install google-genai google-auth
    Set env: GOOGLE_API_KEY=<your-api-key>
    Hoặc dùng --vertex với service account JSON key
"""

import argparse
import os
import sys
import time
from pathlib import Path

# ── Config ──────────────────────────────────────────────

BRANDING_DIR = Path(__file__).resolve().parent
VIDEOS_DIR = BRANDING_DIR / "videos"
ENGINE_DIR = Path(__file__).resolve().parent.parent.parent / "amo-stories-engine"
ENGINE_ENV = ENGINE_DIR / ".env"

MODEL_FULL = "veo-3.1-generate-preview"
MODEL_FAST = "veo-3.1-fast-generate-preview"
MODEL_VEO2 = "veo-2.0-generate-001"

# Vertex AI config
VERTEX_PROJECT = "gen-lang-client-0672758961"
VERTEX_LOCATION = "us-central1"


def load_api_key() -> str:
    """Tự động lấy GOOGLE_API_KEY từ env var hoặc amo-stories-engine/.env"""
    # 1. Ưu tiên env var nếu đã set
    key = os.environ.get("GOOGLE_API_KEY")
    if key:
        return key

    # 2. Đọc từ amo-stories-engine/.env
    if ENGINE_ENV.exists():
        for line in ENGINE_ENV.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("GOOGLE_API_KEY=") and not line.startswith("#"):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
                if key:
                    print(f"🔑 Loaded API key from {ENGINE_ENV}")
                    return key

    print("❌ Không tìm thấy GOOGLE_API_KEY!")
    print(f"   Kiểm tra: {ENGINE_ENV}")
    print("   Hoặc set: $env:GOOGLE_API_KEY = 'your-key'")
    sys.exit(1)


def find_service_account_key() -> str:
    """Tìm file service account JSON key trong amo-stories-engine/"""
    for f in ENGINE_DIR.glob("gen-lang-client-*.json"):
        print(f"🔑 Found service account key: {f.name}")
        return str(f)
    # Fallback: check branding dir
    for f in BRANDING_DIR.glob("*-key.json"):
        print(f"🔑 Found service account key: {f.name}")
        return str(f)
    print("❌ Không tìm thấy service account key!")
    print(f"   Kiểm tra: {ENGINE_DIR}/gen-lang-client-*.json")
    sys.exit(1)


def create_client(use_vertex: bool = False):
    """Tạo genai Client — Gemini API hoặc Vertex AI."""
    from google import genai

    if use_vertex:
        from google.oauth2 import service_account
        key_path = find_service_account_key()
        creds = service_account.Credentials.from_service_account_file(
            key_path,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        client = genai.Client(
            vertexai=True,
            project=VERTEX_PROJECT,
            location=VERTEX_LOCATION,
            credentials=creds,
        )
        print(f"☁️  Vertex AI mode — project={VERTEX_PROJECT}, location={VERTEX_LOCATION}")
        return client
    else:
        api_key = load_api_key()
        return genai.Client(api_key=api_key)

# ── Preset Prompts (từ Visual World Bible) ──────────────

PRESETS = {
    # ── Character Hero Shots ──
    "vanguard": {
        "prompt": (
            "Cinematic dark fantasy character portrait, vertical 9:16. "
            "A battle-hardened man in his late twenties with a square jaw, old scar across his left cheek, "
            "and short dark hair tied back. He wears dented but functional medieval plate-and-leather armor, "
            "standing at the edge of a battlefield engulfed in crimson fog. His longsword glows with faint "
            "orange energy veins. Wind whips his short cloak. Behind him: the silhouette of a massive dark "
            "gate oozing darkness. His stance is wide, grounded — the stance of a man who will not retreat. "
            "His dark brown eyes burn with quiet defiance. Volumetric lighting from the gate casts dramatic "
            "side-light on his scarred face. Medieval epic warrior, cinematic 4K. Purple-gold-crimson palette."
        ),
        "filename": "vanguard_hero.mp4",
    },
    "catalyst": {
        "prompt": (
            "Cinematic dark fantasy character portrait, vertical 9:16. "
            "A young woman in her mid-twenties with sharp cheekbones, luminous green eyes, and long black hair "
            "braided in an intricate medieval style with a streak of premature silver. She wears a flowing "
            "emerald linen cloak covered in glowing runes, a leather belt hung with alchemical vials. She "
            "stands in an ancient stone laboratory where reality fractures around her — objects float, colors "
            "shift, and liquid gold energy swirls around her outstretched slender fingers. Her expression is "
            "one of fascinated curiosity — a half-smile of someone who just understood a cosmic secret. "
            "Medieval alchemist sorceress, mystical atmosphere, cinematic 4K. Green-gold-purple palette."
        ),
        "filename": "catalyst_hero.mp4",
    },
    "sovereign": {
        "prompt": (
            "Cinematic dark fantasy character portrait, vertical 9:16. "
            "A tall, regal man in his early thirties with high cheekbones, deep grey-blue eyes, and neatly "
            "trimmed dark beard stands atop the balcony of a medieval city's highest tower. He wears ornate "
            "dark robes trimmed with gold thread, ceremonial shoulder pauldrons, and a long silk cape billowing "
            "in the wind. He holds a ceremonial longsword at his side with practiced ease. His expression is "
            "calm, absolute authority — the gaze of a king who has already decided your fate. Below him: a "
            "vast medieval city. A crown of subtle golden energy hovers above his head. Medieval king, "
            "political power, cinematic 4K. Gold-purple-white palette."
        ),
        "filename": "sovereign_hero.mp4",
    },
    "seeker": {
        "prompt": (
            "Cinematic dark fantasy character portrait, vertical 9:16. "
            "A sharp-eyed young woman with pale skin, angular features, and short auburn hair in a practical "
            "ponytail crouches on ancient ruins overgrown with luminescent moss. She holds an obsidian lens to "
            "one pale violet eye, peering at cryptic runes carved into a broken wall. The runes glow faintly "
            "violet in response to her gaze. She wears a dark hooded cloak over a leather explorer's harness "
            "filled with tools and scrolls. Her expression is intense focus — the look of a woman who followed "
            "a thread of truth into the dark and refuses to let go. Medieval scholar explorer, mystery and "
            "discovery, cinematic 4K. Violet-grey-teal palette."
        ),
        "filename": "seeker_hero.mp4",
    },
    "tactician": {
        "prompt": (
            "Cinematic dark fantasy character portrait, vertical 9:16. "
            "A sharp-featured man with narrow steel-grey eyes, angular jaw, and slicked-back black hair stands "
            "over a sand table war map in a dimly lit medieval strategy room. He wears a sleek dark officer's "
            "uniform — minimal decoration, maximum function. Candles cast flickering shadows across his gaunt "
            "face. His long fingers move chess-like war pieces on the map. His face is half-lit, half-shadow — "
            "the face of a man who knows more than he shows. A thin rapier hangs at his hip. Medieval military "
            "strategist, dark intelligence, cinematic 4K. Silver-blue-charcoal palette."
        ),
        "filename": "tactician_hero.mp4",
    },
    "wanderer": {
        "prompt": (
            "Cinematic dark fantasy character portrait, vertical 9:16. "
            "A wind-weathered young woman with sun-browned skin, wild amber eyes, light freckles across her "
            "nose, and long dark brown hair flowing freely in the wind stands on a cliff edge overlooking an "
            "endless wild landscape — ancient forests, distant mountains. She wears patched clothing from many "
            "cultures — leather vest, linen wrap, fur-lined cloak — all hand-stitched. A wrapped bo staff "
            "rests on her shoulder. A loyal wolf-like creature sits at her feet. She looks toward the horizon "
            "with quiet, fierce joy — the look of a woman who belongs to no one and nowhere. Medieval nomad "
            "wanderer, freedom and adventure, cinematic 4K. Green-silver-amber palette."
        ),
        "filename": "wanderer_hero.mp4",
    },

    # ── Archon-Fragment Weapons ──
    "lex": {
        "prompt": (
            "Weapon showcase, vertical 9:16. An impossibly perfect straight sword floating in a beam of golden "
            "light. The blade is flawless white-gold metal that pulses like a heartbeat. Tiny golden chains "
            "wrap around the hilt, extending into the air like living tendrils. Legal runes run along the blade, "
            "shifting and changing. The background is a dark ceremonial hall with pillars carved with laws. "
            "Golden particles drift upward from the sword. Sacred, authoritative, divine. 4K cinematic."
        ),
        "filename": "weapon_lex_primordialis.mp4",
    },
    "veil": {
        "prompt": (
            "Weapon showcase, vertical 9:16. A weapon that constantly shifts form — curved blade melting into "
            "chain whip, reforming as a crescent glaive, then a pair of daggers. Silver-blue metal that looks "
            "like frozen wind. Feathers materialize around it, burn to ash, and reform. It floats freely. "
            "Background: wild open canyon with storm clouds. Liberating, chaotic, beautiful. 4K cinematic."
        ),
        "filename": "weapon_veil_unbound.mp4",
    },

    # ── Skills ──
    "order_strike": {
        "prompt": (
            "Combat skill showcase, vertical 9:16. A warrior's sword glows with golden geometric runes. He "
            "performs a precise downward slash — the blade leaves behind a trail of golden light that forms a "
            "perfect mathematical arc. The impact creates expanding rectangular energy waves. Everything around "
            "the strike point becomes perfectly ordered — debris aligns symmetrically, dust forms patterns. "
            "Dark fantasy, precision combat, 4K cinematic."
        ),
        "filename": "skill_order_strike.mp4",
    },
    "void_pulse": {
        "prompt": (
            "Combat skill showcase, vertical 9:16. A woman raises both hands as deep purple-black energy "
            "implodes INWARD. All light in a 10-meter radius is swallowed. Skills and magical effects in the "
            "area simply STOP — freeze, then dissolve into nothing. For one terrifying second, everything is "
            "absolutely dark and silent. Then light returns. Dark fantasy, absolute denial, 4K cinematic."
        ),
        "filename": "skill_void_pulse.mp4",
    },
}


def list_presets():
    """Hiển thị tất cả preset có sẵn."""
    print("\n🎬 Amoisekai Veo Presets:")
    print("=" * 60)
    for name, data in PRESETS.items():
        short_prompt = data["prompt"][:80] + "..."
        print(f"  {name:<16} → {data['filename']}")
        print(f"  {'':16}   {short_prompt}")
        print()


def generate_video(
    prompt: str,
    output_path: Path,
    model: str = MODEL_FULL,
    aspect_ratio: str = "9:16",
    duration: str = "8",
    person_generation: str = "allow_all",
    use_vertex: bool = False,
):
    """Gọi Veo API để tạo video."""
    from google.genai import types

    client = create_client(use_vertex=use_vertex)

    print(f"🎬 Model: {model}")
    print(f"📐 Aspect ratio: {aspect_ratio}")
    print(f"⏱️  Duration: {duration}s")
    print(f"📝 Prompt: {prompt[:100]}...")
    print(f"💾 Output: {output_path}")
    print()
    print("⏳ Đang gửi request tới Veo API...")

    operation = client.models.generate_videos(
        model=model,
        prompt=prompt,
        config=types.GenerateVideosConfig(
            aspect_ratio=aspect_ratio,
            person_generation=person_generation,
        ),
    )

    # Poll cho đến khi xong
    elapsed = 0
    while not operation.done:
        time.sleep(10)
        elapsed += 10
        mins, secs = divmod(elapsed, 60)
        print(f"   ⏳ Đang tạo video... ({mins}m{secs:02d}s)")
        operation = client.operations.get(operation)

    # Download video
    if not operation.response or not operation.response.generated_videos:
        print("❌ Không nhận được video từ API!")
        if hasattr(operation, "error") and operation.error:
            print(f"   Error: {operation.error}")
        sys.exit(1)

    generated_video = operation.response.generated_videos[0]
    video_obj = generated_video.video

    # Debug: print available attributes
    print(f"   📦 Video object type: {type(video_obj).__name__}")
    if hasattr(video_obj, '__dict__'):
        attrs = {k: type(v).__name__ for k, v in vars(video_obj).items() if not k.startswith('_')}
        print(f"   📦 Attributes: {attrs}")

    # Đảm bảo thư mục tồn tại
    output_path.parent.mkdir(parents=True, exist_ok=True)

    saved = False

    # Method 1: Try save() directly (works for both in some versions)
    if hasattr(video_obj, 'save') and callable(video_obj.save):
        try:
            video_obj.save(str(output_path))
            saved = True
            print("   ✅ Saved via video.save()")
        except Exception as e:
            print(f"   ⚠️ video.save() failed: {e}")

    # Method 2: Try video_bytes (Vertex AI inline data)
    if not saved and hasattr(video_obj, 'video_bytes') and video_obj.video_bytes:
        output_path.write_bytes(video_obj.video_bytes)
        saved = True
        print("   ✅ Saved via video_bytes")

    # Method 3: Try URI download (Gemini API)
    if not saved and hasattr(video_obj, 'uri') and video_obj.uri:
        if use_vertex:
            import urllib.request
            from google.oauth2 import service_account
            import google.auth.transport.requests

            key_path = find_service_account_key()
            creds = service_account.Credentials.from_service_account_file(
                key_path,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            creds.refresh(google.auth.transport.requests.Request())

            req = urllib.request.Request(video_obj.uri)
            req.add_header("Authorization", f"Bearer {creds.token}")
            with urllib.request.urlopen(req) as resp:
                output_path.write_bytes(resp.read())
        else:
            client.files.download(file=video_obj)
            video_obj.save(str(output_path))
        saved = True
        print("   ✅ Saved via URI download")

    if not saved:
        print("❌ Không thể download video!")
        print(f"   Video attrs: {dir(video_obj)}")
        sys.exit(1)

    print(f"\n✅ Video đã lưu: {output_path}")
    print(f"   Kích thước: {output_path.stat().st_size / 1024 / 1024:.1f} MB")


def main():
    parser = argparse.ArgumentParser(
        description="🎬 Amoisekai Veo Video Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  python generate_video.py --preset vanguard
  python generate_video.py --preset catalyst --fast
  python generate_video.py --prompt "Epic dark fantasy scene..." --output scene1.mp4
  python generate_video.py --list
  python generate_video.py --all
        """,
    )
    parser.add_argument("--prompt", "-p", help="Prompt trực tiếp")
    parser.add_argument("--preset", choices=list(PRESETS.keys()), help="Dùng preset có sẵn")
    parser.add_argument("--output", "-o", help="Tên file output (mặc định: từ preset)")
    parser.add_argument("--fast", action="store_true", help="Dùng model nhanh (chất lượng thấp hơn)")
    parser.add_argument("--veo2", action="store_true", help="Dùng Veo 2 (không có audio)")
    parser.add_argument("--ratio", default="9:16", choices=["9:16", "16:9"], help="Tỉ lệ khung hình")
    parser.add_argument("--vertex", action="store_true", help="Dùng Vertex AI (quota cao hơn, cần service account key)")
    parser.add_argument("--list", "-l", action="store_true", help="Liệt kê tất cả presets")
    parser.add_argument("--all", action="store_true", help="Tạo TẤT CẢ presets (cẩn thận quota!)")

    args = parser.parse_args()

    if args.list:
        list_presets()
        return

    # Chọn model
    if args.fast:
        model = MODEL_FAST
    elif args.veo2:
        model = MODEL_VEO2
    else:
        model = MODEL_FULL

    if args.all:
        print("🎬 Tạo TẤT CẢ presets!")
        print(f"   Tổng: {len(PRESETS)} videos")
        print("=" * 60)
        for name, data in PRESETS.items():
            out = VIDEOS_DIR / data["filename"]
            if out.exists():
                print(f"⏭️  Bỏ qua {name} — đã tồn tại: {out}")
                continue
            print(f"\n{'='*60}")
            print(f"🎬 [{name}]")
            generate_video(data["prompt"], out, model=model, aspect_ratio=args.ratio, use_vertex=args.vertex)
        print(f"\n✅ Hoàn tất! Videos lưu tại: {VIDEOS_DIR}")
        return

    if args.preset:
        data = PRESETS[args.preset]
        prompt = data["prompt"]
        output_name = args.output or data["filename"]
    elif args.prompt:
        prompt = args.prompt
        output_name = args.output or "custom_video.mp4"
    else:
        parser.print_help()
        print("\n❌ Cần --prompt hoặc --preset!")
        return

    output_path = VIDEOS_DIR / output_name
    generate_video(prompt, output_path, model=model, aspect_ratio=args.ratio, use_vertex=args.vertex)


if __name__ == "__main__":
    main()
