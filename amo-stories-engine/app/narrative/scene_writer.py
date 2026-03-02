"""Agent: Scene Writer — generates per-scene prose and 3 player choices.

Unlike the monolithic chapter writer, this writes 300-500 words per scene
and receives full context from the previous scene(s) instead of summaries.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from dataclasses import dataclass

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import settings
from app.models.pipeline import Beat, PlannerOutput
from app.models.story import Choice, Scene
from app.narrative.world_context import get_world_context

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "scene_writer.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""
_FULL_SYSTEM_PROMPT = get_world_context() + "\n\n---\n\n" + _SYSTEM_PROMPT


@dataclass
class SceneWriterInput:
    """Input for a single scene generation."""

    chapter_number: int
    scene_number: int
    total_scenes: int
    beat: Beat
    all_beats: list[Beat]
    protagonist_name: str
    previous_scene_prose: str       # Full prose of scene N-1
    previous_scene_prose_2: str     # Full prose of scene N-2
    chosen_choice: Choice | None    # Player's choice from previous scene
    is_chapter_end: bool

    # Player context
    player_state: dict | None = None
    unique_skill: dict | None = None
    fate_instruction: str = ""
    critic_feedback: str = ""
    preference_tags: list[str] | None = None
    skill_usage_this_chapter: int = 0       # How many times skill was used in this chapter
    combat_brief: dict | None = None        # CombatBrief data for combat scenes
    semantic_context: str = ""              # NeuralMemory long-term context
    evolution_context: str = ""             # Skill evolution event context
    resonance_context: str = ""             # Resonance prose descriptors
    weapon_context: str = ""               # Weapon info for narrative integration
    adaptive_context: str = ""             # Adaptive Engine context (archetype + play style)
    tone: str = ""                         # Narrative tone: epic, dark, comedy, slice_of_life, mysterious
    gender: str = "neutral"               # "male" | "female" | "neutral" — NPC address form


_USER_TEMPLATE = """## Chapter {chapter_number} — Scene {scene_number}/{total_scenes}
Protagonist: {protagonist_name}
NPC Address: {npc_address}
Tags: {preference_tags}

## 🎨 GIỌNG VĂN CHO SCENE NÀY (ĐỌC TRƯỚC KHI VIẾT):

### Narrative Tone:
{tone_context}

### Tag Guidance:
{tag_guidance}

---

## Beat hiện tại (Scene {scene_number}):
- Description: {beat_description}
- Tension: {beat_tension}/10
- Purpose: {beat_purpose}
- Scene Type: {scene_type}
- Mood: {beat_mood}
- Is Chapter End: {is_chapter_end}

## Tất cả beats trong chapter (→ = scene hiện tại):
{all_beats_text}

## Prose scene trước (Scene {prev_scene_num}):
{previous_scene_prose}

{previous_scene_prose_2_section}

## Player đã chọn:
{chosen_choice_text}

## Player Identity:
- Values: {values}
- Traits: {traits}
- Motivation: {motivation}
- Power Style: {power_style}

## Unique Skill:
{skill_info}

## Skill Choice Guidance:
{skill_choice_guidance}

## Skill Usage This Chapter: {skill_usage_this_chapter} lần
{skill_overuse_warning}

## Fate Buffer:
{fate_instruction}

{critic_feedback}

## Combat Resolution:
{combat_context}

## Ký ức dài hạn (từ các chương trước):
{semantic_context}

## Skill Evolution:
{evolution_context}

## Resonance:
{resonance_context}

## Weapon:
{weapon_context}

## Adaptive Context:
{adaptive_context}"""


def _format_combat_brief(combat_brief: dict | None) -> str:
    """Format combat brief data as context for the scene writer LLM."""
    if not combat_brief:
        return "Không có combat trong scene này."

    sections = []
    enc = combat_brief.get("encounter_type", "minor")
    outcome = combat_brief.get("final_outcome") or combat_brief.get("outcome", "unknown")
    sections.append(f"**Encounter:** {enc} — **Outcome:** {outcome}")

    # Phases
    phases = combat_brief.get("phases", [])
    if phases:
        sections.append(f"\n### Diễn biến ({len(phases)} phase):")
        for p in phases:
            ph_num = p.get("phase_number", "?")
            ph_outcome = p.get("outcome", "?")
            ph_action = p.get("action_taken", "?")
            ph_intensity = p.get("intensity_used", "?")
            cues = p.get("narrative_cues", [])
            line = f"- Phase {ph_num}: [{ph_action}/{ph_intensity}] → {ph_outcome}"
            if cues:
                line += f"  Cues: {'; '.join(cues[:3])}"
            sections.append(line)

    # Decision points
    dps = combat_brief.get("decision_points", [])
    if dps:
        sections.append(f"\n### Quyết định chiến đấu ({len(dps)} lần):")
        for dp in dps:
            ctx = dp.get("context", "")
            chosen = dp.get("chosen_action", "")
            sections.append(f"- Context: {ctx}")
            if chosen:
                sections.append(f"  → Player chọn: {chosen}")

    # Boss tells
    boss_name = combat_brief.get("boss_template_name") or combat_brief.get("enemy_name")
    if boss_name and combat_brief.get("boss_id"):
        sections.append(f"\n### Boss: {boss_name}")

    # Player state after
    state = combat_brief.get("player_state_after", {})
    if state:
        sections.append(
            f"\n**Sau combat:** HP={state.get('hp', '?')}, "
            f"Stability={state.get('stability', '?')}"
        )

    # Single-phase brief fields (backward compat)
    if not phases and combat_brief.get("combat_score"):
        sections.append(f"Score: {combat_brief['combat_score']:.2f}")
        if combat_brief.get("backlash_triggered"):
            sections.append("⚠️ BACKLASH xảy ra!")
        if combat_brief.get("stability_cost"):
            sections.append(f"Stability cost: {combat_brief['stability_cost']}")

    return "\n".join(sections) if sections else "Không có combat data."


def _format_weapon_context(combat_brief: dict | None, weapon_ctx: str = "") -> str:
    """Format weapon context for combat scene narration.

    Combines weapon_context from SceneWriterInput with any weapon data
    embedded in the combat brief.
    """
    parts = []

    if weapon_ctx:
        parts.append(weapon_ctx)

    # Extract weapon_context from combat brief if present
    if combat_brief and isinstance(combat_brief, dict):
        wc = combat_brief.get("weapon_context", {})
        if wc:
            w_name = wc.get("weapon_name", "")
            w_grade = wc.get("weapon_grade", "")
            if w_name:
                parts.append(f"\u2694️ Combat weapon: {w_name} ({w_grade})")
            if wc.get("soul_linked"):
                parts.append("─ Soul-Linked: weapon phản ứng theo cảm xúc player trong trận")
            if wc.get("signature_available") and wc.get("signature_move_name"):
                parts.append(f"─ Signature Move khả dụng: {wc['signature_move_name']}")
            if wc.get("archon_fragment"):
                parts.append("─ ARCHON-FRAGMENT: weapon có ý chí riêng, mô tả sự uy nghiêm")

    return "\n".join(parts) if parts else "Không có weapon."


def _make_llm(model: str = "", temperature: float = 0.85) -> ChatGoogleGenerativeAI:
    """Create LLM for scene writing."""
    return ChatGoogleGenerativeAI(
        model=model or settings.writer_model,
        temperature=temperature,
        api_key=settings.google_api_key,
    )


_TAG_GUIDANCE = {
    "combat": (
        "COMBAT — Joe Abercrombie (hậu quả thật, không anh hùng hoá bạo lực) + "
        "Hajime Isayama/Attack on Titan (áp lực tuyệt vọng, kẻ địch đe doạ thực sự).\n"
        "- Cấu trúc 3 nhịp: Khai mào → Bước ngoặt → Hậu quả\n"
        "- Vật lý hoá đòn đánh: vị trí không gian, cảm giác cụ thể, cơ thể phản ứng trước não\n"
        "- Kẻ địch phải có ít nhất 1 moment nguy hiểm thực sự — không có easy win\n"
        "- Xen kẽ Burst/Pause tạo nhịp tim\n"
        "- KHÔNG tóm tắt combat — mỗi đòn là câu chuyện nhỏ có chi phí\n\n"
        "Ví dụ voice:\n"
        "\"Anh chém. Trượt. Không phải vì hắn né — mà vì hắn đã không còn ở đó nữa. "
        "Lưỡi dao cắt không khí, và momentum kéo anh chúi về phía trước đúng lúc đầu gối "
        "hắn tìm thấy xương sườn. Thế giới trắng xóa nửa giây. Khi anh thấy lại, sàn đá "
        "đang rất gần mặt.\""
    ),
    "politics": (
        "POLITICS — G.R.R. Martin (subtext, betrayal logic, power corrupts) + "
        "Frank Herbert/Dune (power philosophy, long-game thinking).\n"
        "- Mọi dialogue có tầng nghĩa ẩn — không ai nói thẳng điều thật sự muốn\n"
        "- Mỗi NPC có agenda riêng, quyền lợi riêng — không ai neutral\n"
        "- Thỉnh thoảng để NPC nói điều ĐÚNG nhưng vì lý do SAI\n"
        "- Quyền lực đến từ thông tin và liên minh, không phải sức mạnh thuần\n\n"
        "Ví dụ voice:\n"
        "\"'Ngươi biết vì sao ta cho ngươi ngồi đây không?' Lão cười, nhưng mắt không cười. "
        "'Không phải vì ta tin ngươi. Mà vì hiện tại, kẻ ta không tin nhưng biết rõ — "
        "hữu ích hơn kẻ ta tin nhưng không hiểu.' Lão rót trà. Chỉ một chén. Không mời.\""
    ),
    "romance": (
        "ROMANCE — Makoto Shinkai (khoảnh khắc bình thường nâng tầm, khoảng cách đẹp đau) + "
        "Haruki Murakami (cảm xúc dưới bề mặt, những điều không nói thành lời).\n"
        "- Chi tiết vật lý thay cho tuyên bố cảm xúc: ánh mắt, khoảng cách, nhiệt độ\n"
        "- Tension lãng mạn qua những điều KHÔNG xảy ra nhiều hơn những gì xảy ra\n"
        "- Khoảng lặng ý nghĩa — im lặng có texture, không phải khoảng trống\n"
        "- Tránh cliché: không 'tim đập loạn' — thay bằng chi tiết cụ thể và riêng\n\n"
        "Ví dụ voice:\n"
        "\"Cô ấy đưa tay sửa cổ áo anh. Không cần sửa — anh biết, cô ấy cũng biết. "
        "Nhưng ngón tay cô dừng lại ở đó thêm nửa nhịp thở, và nửa nhịp thở đó dài hơn "
        "mọi câu nói anh từng nghe. Rồi cô rụt tay về, quay đi, và không khí nơi ngón tay "
        "vừa chạm vẫn ấm.\""
    ),
    "mystery": (
        "MYSTERY — Agatha Christie (clue planted early, red herring hợp lý, reveal thoả mãn) + "
        "Patrick Rothfuss (mỗi câu trả lời mở ra bí ẩn sâu hơn).\n"
        "- Foreshadow sớm — detail tưởng thừa nhưng sẽ quan trọng sau\n"
        "- Red herring tự nhiên: không cố ý lừa, chỉ đặt thông tin gây hiểu nhầm hợp lý\n"
        "- POV giới hạn: player chỉ thấy những gì scene cho phép — không omniscient\n"
        "- Reveal đúng thời điểm — không quá sớm, không giữ quá lâu\n\n"
        "Ví dụ voice:\n"
        "\"Ba điều sai. Thứ nhất, cửa không khóa — ở nơi mà mọi cánh cửa đều khóa. "
        "Thứ hai, trên bàn có hai chén trà nhưng chỉ một ghế. Thứ ba — và điều này "
        "anh mất vài giây mới nhận ra — bóng của mình trên tường hơi lệch so với "
        "vị trí anh đang đứng. Chỉ hơi. Nhưng đủ.\""
    ),
    "horror": (
        "HORROR — Stephen King (nhân vật bình thường, mundane detail → creeping dread) + "
        "Shirley Jackson (tâm lý bất ổn, thực tại không đáng tin).\n"
        "- Bắt đầu từ chi tiết đời thường bình thường TRƯỚC KHI chúng trở nên sai\n"
        "- POV hẹp — không biết nguồn gốc, không thấy toàn cảnh là đáng sợ nhất\n"
        "- Cơ thể trước não: lạnh gáy, dừng thở, chân không chịu di chuyển\n"
        "- KHÔNG reveal hết — cái không thấy đáng sợ hơn cái thấy\n\n"
        "Ví dụ voice:\n"
        "\"Tiếng cười trẻ con vang lên từ phòng bên — bình thường, nếu không phải tầng này "
        "bỏ hoang từ năm ngoái. Anh dừng bước. Không phải vì sợ. Chưa. Mà vì chân anh "
        "dừng trước não — và cơ thể luôn biết trước những điều não chưa chịu tin. "
        "Tiếng cười lặp lại. Lần này gần hơn. Nhưng cửa phòng bên vẫn đóng.\""
    ),
    "cultivation": (
        "CULTIVATION — Er Gen/ISSTH (inner world perception, breakthrough ceremony, Dao) + "
        "I Eat Tomatoes/Coiling Dragon (clear power progression, martial kinetics).\n"
        "- Mô tả quá trình nội tại cụ thể: Nguyên Tắc là gì, cảm nhận thế nào khi Qi lưu chuyển\n"
        "- Đột phá có giá: không free power-up — cần trigger, thường đến qua khủng hoảng thực sự\n"
        "- Terminology nhất quán: dùng khái niệm đã establish trong world\n"
        "- Cân bằng: tu luyện là tool phục vụ câu chuyện, không phải mục đích\n\n"
        "Ví dụ voice:\n"
        "\"Nguyên khí không chảy — nó RƠI. Như nước bị ai đó dốc ngược bên trong cơ thể, "
        "từ đỉnh đầu xuống đan điền, nhanh đến mức xương sống anh rung lên một tiếng đàn "
        "trầm không ai nghe thấy ngoài chính anh. Và rồi nó dừng. Không phải hết — mà là "
        "ĐẦY. Lần đầu tiên, anh hiểu thế nào là giới hạn của bình chứa.\""
    ),
    "adventure": (
        "ADVENTURE — Tolkien (world as living character, earned discovery, beauty có chiều sâu) + "
        "Miyazaki/Studio Ghibli tone (joy of exploration, ecosystem wonder, không giải thích mọi thứ).\n"
        "- Mô tả cảnh vật có chiều sâu — không chỉ visual mà còn smell, sound, texture\n"
        "- Mỗi địa điểm mới là nhân vật riêng — có tính cách, lịch sử ngầm, cảm giác riêng\n"
        "- Wonderment tự nhiên — player cảm thấy thế giới rộng hơn mình tưởng\n"
        "- Discovery có stakes: không phải tourist, mà là người tìm hiểu để sống sót\n\n"
        "Ví dụ voice:\n"
        "\"Con đường biến mất ở đây — không phải mất, mà bị cỏ nuốt. Loại cỏ cao đến thắt lưng, "
        "lá xanh nhưng gân lá đỏ như mạch máu, và khi gió thổi chúng uốn cùng một hướng "
        "như thể đang chỉ đường cho ai đó không phải anh. Phía trước, giữa biển cỏ, "
        "một cây cổ thụ đứng một mình — và dưới gốc, ánh sáng nào đó nhấp nháy. "
        "Không phải lửa. Lạnh hơn lửa.\""
    ),
    "strategy": (
        "STRATEGY — Code Geass/Lelouch (N-step deception, nhìn thấy consequences của consequences) + "
        "Legend of Galactic Heroes (tactical-political interplay, information asymmetry).\n"
        "- Suy nghĩ nhân vật thể hiện chuỗi if-then logic rõ ràng — không phải instinct\n"
        "- Kẻ địch cũng có kế hoạch riêng — outsmart không phải may mắn mà là preparation\n"
        "- Mỗi quyết định có ripple effect — nhắc nhở player về consequences đến sau\n"
        "- Information asymmetry là nguồn drama chính: ai biết gì, ai không biết gì\n\n"
        "Ví dụ voice:\n"
        "\"Ba nước cờ. Hắn cho anh thấy ba nước cờ — nghĩa là nước thứ tư mới là thật. "
        "Anh đã đếm lính gác: mười hai, nhưng chỉ mười đeo kiếm. Hai người còn lại mặc "
        "giáp nhẹ, mắt luôn nhìn về phía cổng phụ. Hắn biết anh sẽ nhìn cổng chính. "
        "Hắn đúng. Nhưng anh cũng biết hắn biết — và đó mới là lợi thế thực sự.\""
    ),
}

_TONE_DESC = {
    "epic": (
        "SỬ THI — Robert Jordan/Wheel of Time + Brandon Sanderson: ngôn ngữ trang trọng, hùng tráng. "
        "Nhấn mạnh vận mệnh, khoảnh khắc anh hùng có trọng lượng lịch sử. "
        "Mỗi scene cảm giác như phần của câu chuyện lớn hơn player. "
        "Dialogue có tiếng vang — lời nói ở đây quan trọng hơn nơi khác.\n\n"
        "### Ví dụ voice (epic tone):\n"
        "\"Ánh sáng cuối cùng của mặt trời không tắt — nó bị nuốt. Bóng tối ập xuống từ phía "
        "đông như tấm màn của ai đó vừa mất kiên nhẫn với vở kịch này, và trong khoảnh khắc "
        "trước khi bóng đêm hoàn toàn, anh nhìn thấy nó: đạo quân đang di chuyển dưới chân núi, "
        "đuốc của họ lấp lánh như những ngôi sao rơi xuống mặt đất và quyết định ở lại. "
        "Đó là lúc anh hiểu — trận chiến này không phải của mình. Nhưng kết cục thì có.\""
    ),
    "dark": (
        "DARK FANTASY — Joe Abercrombie/First Law + Mark Lawrence/Prince of Thorns: tàn khốc, moral grey. "
        "Không có anh hùng thuần tuý — chỉ có người ít xấu hơn người khác. "
        "Chiến thắng là pyrrhic, sacrifice thực sự đau. "
        "Thỉnh thoảng dark humour để nhấn mạnh sự vô lý của bạo lực — không glorify.\n\n"
        "### Ví dụ voice (dark tone):\n"
        "\"Hắn chết chậm hơn anh nghĩ. Đó là điều đầu tiên anh học được về việc giết người — "
        "nó không gọn gàng. Không có khoảnh khắc anh hùng, không có ánh mắt cuối cùng đầy ý nghĩa. "
        "Chỉ có tiếng thở bọt, mùi đồng tanh, và cái cách ngón tay hắn vẫn bấu vào cổ tay anh "
        "dù mắt đã không còn nhìn thấy gì. Anh ngồi đó cho đến khi tay hắn tuột ra. "
        "Lâu hơn anh muốn. Lâu hơn bất cứ ai nên phải ngồi chờ.\""
    ),
    "comedy": (
        "HÀI HƯỚC — Terry Pratchett/Discworld + Konosuba (Akatsuki Natsume): timing comedy tốt. "
        "Pratchett: hài qua sự thật cay đắng được nói thẳng, absurd tình huống với nhân vật earnest. "
        "Konosuba: tsukkomi/boke, nhân vật tự nhận thức về sự vô lý của chính mình. "
        "Dialogue witty, subtext hài hước — không bao giờ giải thích joke.\n\n"
        "### Ví dụ voice (comedy tone):\n"
        "\"Theo lý thuyết, anh đang chạy trốn. Nhưng 'chạy trốn' nghe có vẻ quá phẩm giá cho "
        "việc lăn xuống sườn đồi với tư thế của một bao khoai tây bị từ chối nhập kho. "
        "Con quái vật phía sau — anh vẫn chưa biết nó là gì, nhưng chắc chắn nó có quá nhiều "
        "răng cho một sinh vật chỉ có một miệng — đang đuổi theo với sự kiên nhẫn đáng ngưỡng mộ "
        "của kẻ biết rằng bữa tối không thể chạy nhanh hơn mình.\""
    ),
    "slice_of_life": (
        "SLICE OF LIFE — Makoto Shinkai/iyashikei: chậm rãi, chi tiết đời thường tinh tế. "
        "Khoảnh khắc nhỏ mang ý nghĩa lớn: bữa ăn sáng, tiếng mưa, ánh nắng chiều tà. "
        "Nhân vật có routine và suy nghĩ không liên quan plot — họ sống, không chỉ react. "
        "Cảm xúc nhẹ nhàng sâu, tránh drama thái quá — melancholy đẹp, không bi ai.\n\n"
        "### Ví dụ voice (slice_of_life tone):\n"
        "\"Canh nấm hôm nay mặn hơn hôm qua, và anh không hiểu tại sao điều đó lại khiến "
        "mình mỉm cười. Có lẽ vì nó là thứ duy nhất ở đây giống với thế giới cũ — cái cảm giác "
        "nêm quá tay rồi không có gì để sửa. Bên ngoài, tiếng mưa gõ lên mái tranh đều đặn "
        "như nhịp thở của ai đó đang ngủ. Companion ngồi đối diện, chống cằm, mắt nhìn ra "
        "ngoài cửa sổ nhưng không nhìn gì cả. Yên tĩnh. Thứ yên tĩnh không đòi hỏi phải lấp đầy.\""
    ),
    "mysterious": (
        "HUYỀN BÍ — Patrick Rothfuss/Kingkiller Chronicle + Ursula K. Le Guin/Earthsea: "
        "câu hỏi nhiều hơn câu trả lời. "
        "Mỗi reveal mở ra bí ẩn mới — không bao giờ fully explained. "
        "Atmosphere > action: cảm giác 'có gì đó không đúng' là trọng tâm. "
        "Foreshadowing qua chi tiết nhỏ — player nhận ra sau, không phải trong lúc đọc.\n\n"
        "### Ví dụ voice (mysterious tone):\n"
        "\"Cánh cửa mở ra trước khi anh chạm vào. Không phải từ từ — mà như thể nó đã mở sẵn, "
        "và chỉ bây giờ anh mới nhận ra. Bên trong, không khí có mùi kỳ lạ. Không hôi, không thơm. "
        "Mùi của thứ gì đó cổ xưa đến mức ngôn ngữ chưa kịp đặt tên cho nó. Trên bàn, "
        "một cuốn sách đang mở — và trang sách ướt, như vừa có người đọc xong rồi khóc lên trên "
        "từng con chữ. Nhưng bụi trên sàn cho thấy không ai bước vào đây từ rất, rất lâu.\""
    ),
}


_SKILL_CONSEQUENCE_RULES = """
QUY TẮC CONSEQUENCE HINT cho skill choice:
- Consequence hint là gợi ý tự nhiên về cảm giác/trạng thái sau khi dùng skill — không spoil, không cảnh báo thẳng
- Hậu quả thực tế (thất bại, phản tác dụng, không hiệu quả) thể hiện trong PROSE của scene tiếp theo
- Hint chỉ gợi mở: VD "Kỹ năng này chưa được thử trong tình huống như vậy" thay vì "có thể thất bại"
- Nếu skill phù hợp → hint gợi ý lợi thế + nhắc nhẹ đến limitation (không nói sẽ thành công)"""


def _build_skill_choice_guidance(
    scene_type: str,
    tension: int,
    beat_description: str,
    skill: dict | None,
    skill_usage: int,
) -> str:
    """Compute an explicit skill choice recommendation for the AI writer.

    Gives the AI a clear YES/NO/OPTIONAL signal so it doesn't have to guess
    whether to include a skill choice in choices[].
    """
    if not skill or not skill.get("name"):
        return "Không có skill — không cần skill choice."

    skill_name = skill.get("name", "")
    limitation = skill.get("limitation", "")
    activation_condition = skill.get("activation_condition", "")
    weakness = skill.get("weakness", "")

    # Build the consequence logic reminder (always appended to mandatory cases)
    consequence_reminder = (
        f"\nConsequence logic cho writer:\n"
        f"- Activation condition: {activation_condition or 'không rõ'}\n"
        f"- Limitation: {limitation or 'không rõ'}\n"
        f"- Weakness: {weakness or 'không rõ'}\n"
        f"→ Nếu scene này KHÔNG đáp ứng activation_condition → consequence_hint PHẢI cảnh báo "
        f"khả năng thất bại/không kích hoạt/phản tác dụng."
        f"{_SKILL_CONSEQUENCE_RULES}"
    )

    # Cooldown check: 3+ uses = strongly discourage
    if skill_usage >= 3:
        return (
            f"⛔ KHÔNG NÊN — {skill_name} đã được dùng {skill_usage} lần trong chapter này. "
            f"Overuse sẽ phản tác dụng. Choices nên phản ánh hậu quả overuse, không cung cấp thêm skill choice."
        )

    # Combat: always required
    if scene_type == "combat":
        return (
            f"✅ BẮT BUỘC — scene combat, PHẢI có 1 choice dạng '[{skill_name}] — hành động chiến đấu'.\n"
            f"Consequence hint: gợi ý tự nhiên (không spoil, không cảnh báo thẳng).\n"
            f"Hậu quả thực tế nếu skill không phù hợp tình huống → thể hiện trong prose scene tiếp theo."
            + consequence_reminder
        )

    # Discovery: always, it's the climactic skill moment
    if scene_type == "discovery":
        return (
            f"✅ BẮT BUỘC — scene discovery, skill là trọng tâm.\n"
            f"Choice '[{skill_name}] — ...' miêu tả khoảnh khắc kích hoạt/khám phá skill.\n"
            f"Consequence hint: gợi mở cảm giác — không spoil kết quả."
            + consequence_reminder
        )

    # Exploration: recommend if tension is high or beat hints at skill use
    if scene_type == "exploration":
        skill_keywords = [skill_name.lower()] + [
            w for w in (skill.get("activation_condition") or "").lower().split()
            if len(w) > 3
        ]
        beat_lower = beat_description.lower()
        skill_relevant = any(kw in beat_lower for kw in skill_keywords)

        if tension >= 6 or skill_relevant:
            return (
                f"✅ KHUYẾN NGHỊ — tension={tension}/10 hoặc beat liên quan skill. "
                f"Thêm '[{skill_name}] — ...' như 1 choice. "
                f"Phù hợp nếu skill giúp cảm nhận hoặc phản ứng với môi trường."
            )
        return (
            f"⚡ TÙY CHỌN — tension thấp ({tension}/10), chỉ thêm '[{skill_name}]' "
            f"nếu tình huống trong prose tự nhiên dẫn đến việc dùng skill."
        )

    # Dialogue: recommend only if high tension or skill is social/perception type
    if scene_type == "dialogue":
        social_categories = ("perception", "manipulation", "contract")
        is_social_skill = skill.get("category", "") in social_categories
        if tension >= 7 or is_social_skill:
            return (
                f"✅ KHUYẾN NGHỊ — {'skill phù hợp với đối thoại' if is_social_skill else f'tension cao {tension}/10'}. "
                f"Choice '[{skill_name}] — ...' có thể là đọc tâm lý, giao ước, hoặc quan sát đối phương."
            )
        return (
            f"⚡ TÙY CHỌN — chỉ thêm '[{skill_name}]' nếu skill tự nhiên có thể áp dụng "
            f"trong cuộc đối thoại này (đọc người, phán đoán, v.v.)."
        )

    # Rest: rarely appropriate
    if scene_type == "rest":
        if tension >= 5:
            return (
                f"⚡ TÙY CHỌN — scene nghỉ ngơi với tension={tension}/10. "
                f"Có thể thêm skill choice nếu scene focus vào luyện tập hoặc phản tư về skill."
            )
        return f"⛔ KHÔNG NÊN — scene nghỉ ngơi yên tĩnh, không cần skill choice. Giữ 3 choices thường."

    return (
        f"⚡ TÙY CHỌN — xem xét thêm '[{skill_name}] — ...' nếu tình huống phù hợp."
    )


def _get_npc_address(gender: str) -> str:
    """Return contextual NPC address guidance based on player gender.

    Returns a multi-line instruction so NPCs use varied, situationally
    appropriate address forms instead of a single fixed word.
    """
    base = {"male": "anh", "female": "cô"}.get(gender, "bạn")
    return (
        f'Prose narrator (ngôi 2): "{base}" — luôn gọi player bằng "{base}" trong narrative.\n'
        f"NPC xưng hô với player — LINH HOẠT theo ngữ cảnh (KHÔNG cố định một từ):\n"
        f'- Bạn đồng hành / NPC ngang hàng: "{base}"\n'
        f'- NPC lớn tuổi, có vai vế (thầy, trưởng làng, huynh trưởng): "con" hoặc tên player\n'
        f'- Kẻ địch / hostile / combat: "ngươi" (thô lỗ, aggressive — BẮT BUỘC trong đối thoại địch)\n'
        f'- NPC cấp dưới / phục tùng: "ngài" hoặc tên player (trang trọng)\n'
        f'- Người lạ lần đầu gặp: "{base}" (lịch sự)\n'
        f"- Isekai/cultivation setting: cho phép dùng ngươi/ta/huynh/muội/đại nhân khi phù hợp\n"
        f'⚠️ KHÔNG dùng "{base}" cho mọi NPC — địch phải dùng "ngươi", người lớn hơn dùng từ phù hợp.'
    )


# ── Multi-tag blending combos ──
_TAG_BLEND_HINTS: dict[frozenset[str], str] = {
    frozenset({"combat", "politics"}): (
        "⚡ BLEND: Combat + Politics = mỗi đòn đánh là nước cờ chính trị. "
        "Người quan sát trận đấu quan trọng hơn kẻ chiến đấu. Thắng combat có thể thua politics."
    ),
    frozenset({"combat", "romance"}): (
        "⚡ BLEND: Combat + Romance = bảo vệ người quan trọng tạo stakes thật. "
        "Sau combat, khoảnh khắc kiểm tra vết thương của nhau nói nhiều hơn lời tỏ tình."
    ),
    frozenset({"romance", "politics"}): (
        "⚡ BLEND: Romance + Politics = tình cảm bị xen lẫn toan tính. "
        "Mỗi khoảnh khắc thân mật đều có câu hỏi ẩn: đây là thật hay vì lợi ích? "
        "Cảm xúc chân thành nhất xuất hiện khi không ai quan sát."
    ),
    frozenset({"adventure", "romance"}): (
        "⚡ BLEND: Adventure + Romance = khám phá thế giới MỚI cùng nhau. "
        "Bond xây qua shared wonder — cùng ngạc nhiên, cùng sợ, cùng im lặng trước cảnh đẹp. "
        "Khoảng cách thu hẹp qua hành trình, không qua lời nói."
    ),
    frozenset({"adventure", "politics"}): (
        "⚡ BLEND: Adventure + Politics = mỗi vùng đất mới có luật riêng, phe phái riêng. "
        "Khám phá không vô tội — bước chân vào lãnh thổ mới = chọn phe dù không muốn. "
        "Thông tin từ exploration trở thành vũ khí chính trị."
    ),
    frozenset({"mystery", "horror"}): (
        "⚡ BLEND: Mystery + Horror = manh mối dẫn đến nơi không muốn đến. "
        "Càng hiểu nhiều càng sợ. Reveal không mang đến an tâm mà mang đến dread sâu hơn."
    ),
    frozenset({"adventure", "romance", "politics"}): (
        "⚡ BLEND 3 TAGS: Adventure + Romance + Politics = hành trình qua thế giới đầy phe phái, "
        "nơi mỗi vùng đất mới đặt ra câu hỏi về lòng trung thành. Romance tension xây qua "
        "shared danger và những khoảnh khắc riêng tư hiếm hoi giữa drama chính trị. "
        "Cảnh vật hùng vĩ nhưng luôn có bóng của quyền lực đằng sau. "
        "Mỗi NPC mới vừa là guide vừa có agenda. Cảm xúc chân thật nhất lộ ra khi stakes cao nhất."
    ),
}


def _build_tag_guidance(tags: list[str] | None) -> str:
    """Build writing guidance from preference tags with multi-tag blending."""
    if not tags:
        return "Tự do — viết cân bằng giữa các yếu tố."
    valid = [t for t in tags if t in _TAG_GUIDANCE]
    if not valid:
        return "Tự do — viết cân bằng giữa các yếu tố."

    parts = [_TAG_GUIDANCE[t] for t in valid]
    result = "\n\n".join(parts)

    # ── Multi-tag blending synthesis ──
    if len(valid) >= 2:
        tag_set = frozenset(valid)
        # Check exact match first, then subsets
        blend = _TAG_BLEND_HINTS.get(tag_set)
        if not blend:
            # Find largest matching subset
            best_match = None
            best_len = 0
            for combo, hint in _TAG_BLEND_HINTS.items():
                if combo.issubset(tag_set) and len(combo) > best_len:
                    best_match = hint
                    best_len = len(combo)
            blend = best_match

        if blend:
            result += f"\n\n---\n{blend}"
        else:
            # Generic multi-tag instruction
            tag_names = " + ".join(valid)
            result += (
                f"\n\n---\n"
                f"⚡ BLEND ({tag_names}): Không viết từng tag riêng lẻ — "
                f"WEAVE chúng vào nhau. Mỗi đoạn prose nên phản ánh ÍT NHẤT 2 tags cùng lúc. "
                f"VD: mô tả cảnh (adventure) qua con mắt đánh giá chiến thuật (strategy), "
                f"hoặc dialogue chính trị (politics) có undercurrent lãng mạn (romance)."
            )

    return result


# ── Scene Type × Tone voice matrix ──
# Each key is (scene_type, tone) → short prose example showing the exact voice.
_SCENE_TONE_VOICE: dict[tuple[str, str], str] = {
    # ═══ COMBAT ═══
    ("combat", "epic"): (
        "🗡️ Combat × Epic:\n"
        "\"Lưỡi kiếm chạm nhau — và tiếng va không vang. Nó BỔ. Như sấm gõ vào xương "
        "núi. Anh trượt lui hai bước, đất nứt dưới gót, và trong khoảng trống giữa hai đòn, "
        "anh nghe thấy nó: tiếng gầm của hàng nghìn người phía dưới sườn đồi đang chờ "
        "kết quả trận đấu mà chính anh chưa biết mình có sống sót không.\""
    ),
    ("combat", "dark"): (
        "🗡️ Combat × Dark:\n"
        "\"Không có gì anh hùng ở đây. Chỉ có hai thằng đang cố giết nhau trong bùn, "
        "và thằng nào trượt trước sẽ chết. Hắn trượt trước. Anh đâm. Không sạch, "
        "không đẹp — lưỡi dao kẹt giữa xương sườn và anh phải dùng cả hai tay để rút ra. "
        "Sau đó anh nôn. Không phải vì sợ. Chỉ vì cơ thể quyết định vậy.\""
    ),
    ("combat", "comedy"): (
        "🗡️ Combat × Comedy:\n"
        "\"Về mặt kỹ thuật, đây là chiến đấu. Về mặt thực tế, đây là hai người đang "
        "quăng đồ nội thất vào nhau trong một căn phòng quá nhỏ cho bất kỳ ai có phẩm giá. "
        "Hắn ném ghế. Anh né — bằng cách ngã. Rất chiến thuật. Rất có chủ ý. Hoàn toàn "
        "không phải vì chân vướng thảm.\""
    ),
    ("combat", "slice_of_life"): (
        "🗡️ Combat × Slice of Life:\n"
        "\"Đó không phải trận chiến — đó là sparring buổi sáng. Gỗ chạm gỗ, nhịp "
        "đều như tiếng chày giã gạo. giữa hai đòn, companion hỏi: 'Ăn gì chưa?' "
        "Anh chưa. Cái đói làm đòn tiếp theo hơi lệch. Companion cười. 'Thấy chưa. "
        "Bao tử còn quan trọng hơn kiếm pháp.'\""
    ),
    ("combat", "mysterious"): (
        "🗡️ Combat × Mysterious:\n"
        "\"Hắn di chuyển sai. Không phải sai kiểu dở — sai kiểu KHÔNG THỂ. Cơ thể "
        "hắn rẽ trái nhưng bóng rẽ phải, và khi anh chém vào chỗ hắn ĐANG đứng, "
        "lưỡi kiếm cắt qua... không khí? Hắn? Anh không chắc. Chỉ biết tay cầm kiếm "
        "lạnh hơn trước. Và hắn đang cười.\""
    ),

    # ═══ EXPLORATION ═══
    ("exploration", "epic"): (
        "🌄 Exploration × Epic:\n"
        "\"Cánh đồng trải rộng đến chân trời — và chân trời CONG. Không phải cong "
        "như quả địa cầu. Cong như thể ai đó uốn mặt đất bằng tay, bắt nó chạm vào "
        "bầu trời ở nơi xa nhất. Giữa đồng, những cột đá đứng hàng — cao hơn "
        "bất kỳ thứ gì đôi tay phàm có thể dựng. Đây là nơi ai đó đã tạo nên "
        "trước khi 'ai đó' có nghĩa.\""
    ),
    ("exploration", "dark"): (
        "🌄 Exploration × Dark:\n"
        "\"Con đường kết thúc ở một ngôi làng. Hoặc từng là ngôi làng. Nhà cửa vẫn "
        "đứng — đó mới là phần kỳ lạ. Không cháy, không đổ. Chỉ trống. Bát cơm "
        "trên bàn, nước trong bát đã khô thành vệt nâu. Ai đó đã rời đi giữa bữa ăn "
        "và không bao giờ quay lại. Lý do nằm ở mùi. Mùi từ giếng.\""
    ),
    ("exploration", "comedy"): (
        "🌄 Exploration × Comedy:\n"
        "\"Bản đồ nói rẽ phải tại 'hòn đá hình con vịt.' Có ba hòn đá. Tất cả đều "
        "hình con vịt nếu nghiêng đầu đúng cách. Hoặc không hòn nào hình con vịt. "
        "Phụ thuộc vào quan điểm triết học về hình dáng con vịt.\""
    ),
    ("exploration", "slice_of_life"): (
        "🌄 Exploration × Slice of Life:\n"
        "\"Dòng suối nông vừa đủ mắt cá chân. Nước lạnh — cái lạnh dễ chịu, như "
        "khi ai đó đặt khăn ướt lên trán. Hai bên bờ, hoa dại mọc nghiêng về phía nước, "
        "và nếu ngồi đủ lâu, sẽ thấy cá nhỏ liếm đá dưới đáy. Không có gì nguy hiểm. "
        "Không có gì gấp. Chỉ thế giới đang sống rất chậm.\""
    ),
    ("exploration", "mysterious"): (
        "🌄 Exploration × Mysterious:\n"
        "\"Rêu trên tường đền chỉ mọc phía trái. Chỉ phía trái. Anh không biết "
        "tại sao điều đó khiến mình dừng lại — nhưng não đã đánh dấu nó như thứ gì đó "
        "QUAN TRỌNG trước khi lý trí kịp giải thích. Bên trong, sàn đá phẳng hoàn hảo, "
        "trừ một chỗ — một vết lõm nhỏ hình bàn tay. Quá nhỏ cho người lớn. "
        "Quá sâu cho thời gian.\""
    ),

    # ═══ DIALOGUE ═══
    ("dialogue", "epic"): (
        "💬 Dialogue × Epic:\n"
        "\"'Ngươi có biết người cuối cùng đứng ở vị trí đó đã nói gì không?' "
        "Lão già nhìn anh — không phải nhìn anh, mà nhìn qua anh, vào một thứ gì đó "
        "phía sau rất lâu rồi. 'Hắn nói: Tôi sẽ quay lại.' Lão im. 'Đó là ba trăm năm trước.'\""
    ),
    ("dialogue", "dark"): (
        "💬 Dialogue × Dark:\n"
        "\"'Ngươi giết bao nhiêu người rồi?' Hắn hỏi bằng giọng người hỏi thời tiết. "
        "Anh không trả lời. Không phải vì xấu hổ — mà vì không nhớ. "
        "Và việc không nhớ mới là thứ đáng xấu hổ.\""
    ),
    ("dialogue", "comedy"): (
        "💬 Dialogue × Comedy:\n"
        "\"'Ngươi có kế hoạch gì không?' Companion nhìn anh, đầy hy vọng. "
        "'Có.' 'Thật sao?' 'Không chết.' 'Đó... đó không phải kế hoạch.' "
        "'Đó là mục tiêu. Kế hoạch sẽ đến khi nào tìm được.'\""
    ),
    ("dialogue", "slice_of_life"): (
        "💬 Dialogue × Slice of Life:\n"
        "\"'Ngươi nhớ nhà không?' Câu hỏi đến lúc cả hai đang nhìn lửa. Không có "
        "lý do nào hỏi. Cũng không cần lý do. 'Nhớ...' anh ngừng. Nhớ gì? "
        "Mùi cà phê? Tiếng chuông đồng hồ? Hay chỉ cái cảm giác biết mình thuộc về đâu?\""
    ),
    ("dialogue", "mysterious"): (
        "💬 Dialogue × Mysterious:\n"
        "\"'Đừng hỏi tên ta.' 'Tại sao?' 'Vì ta sẽ trả lời. Và khi ta trả lời, "
        "ngươi sẽ nhớ. Và có những thứ, một khi nhớ, ngươi không thể quên. "
        "Ngươi có thực sự muốn mang thêm một thứ không thể quên?'\""
    ),

    # ═══ DISCOVERY ═══
    ("discovery", "epic"): (
        "✨ Discovery × Epic:\n"
        "\"Nó bắt đầu từ ngón tay. Ánh sáng — không, không phải ánh sáng. Kẻ nào "
        "phát minh ra từ 'ánh sáng' chưa bao giờ thấy THỨ NÀY. Nó trào ra từ dưới da, "
        "và với nó là tiếng thì thầm của ngàn giọng nói không phải của ai. "
        "Vận mệnh không hỏi ý kiến. Nó đến. Và anh thay đổi.\""
    ),
    ("discovery", "dark"): (
        "✨ Discovery × Dark:\n"
        "\"Sức mạnh đến. Không đẹp. Nó bò lên cổ tay như kiến, và mỗi con kiến "
        "mang theo ký ức không phải của anh — máu, khói, tiếng gào. Ai đó đã dùng "
        "thứ này trước anh. Họ không sống sót. Và bây giờ anh hiểu tại sao: "
        "không phải sức mạnh giết họ. Mà là thứ họ phải ĐỔI.\""
    ),
    ("discovery", "mysterious"): (
        "✨ Discovery × Mysterious:\n"
        "\"Anh nhìn xuống tay mình. Vẫn tay đó. Vẫn năm ngón. Nhưng bóng trên tường "
        "có sáu. Anh đếm lại. Năm. Bóng: sáu. Ngón thứ sáu cử động — không theo "
        "bất kỳ ngón nào. Và rồi, rất chậm, nó chỉ về phía bắc.\""
    ),

    # ═══ REST ═══
    ("rest", "epic"): (
        "🌙 Rest × Epic:\n"
        "\"Đêm xuống. Ngọn lửa nhỏ, nhưng đủ để thấy mặt nhau. Companion không ngủ — "
        "ngồi gác kiếm, mắt nhìn vào bóng tối như thể đang đọc thứ gì đó viết "
        "bằng ngôn ngữ của bóng. 'Ngày mai,' companion nói, và không nói thêm. "
        "Không cần. Ngày mai đã nặng đủ mà không cần lời.\""
    ),
    ("rest", "dark"): (
        "🌙 Rest × Dark:\n"
        "\"Anh rửa máu khỏi tay trong dòng suối. Nước chạy đỏ, rồi hồng, rồi trong. "
        "Tay sạch. Nhưng dưới móng vẫn còn. Luôn còn. Anh nhìn mặt mình trên "
        "mặt nước — và không nhận ra. Không phải vì thay đổi. "
        "Mà vì khuôn mặt đó không CÓ VẺ của ai quen.\""
    ),
    ("rest", "comedy"): (
        "🌙 Rest × Comedy:\n"
        "\"Bụng kêu. Đó là sự thật duy nhất còn quan trọng sau một ngày suýt chết "
        "bốn lần. Companion mở ba lô — bên trong có chính xác một củ khoai "
        "và sự thất vọng. 'Chia đôi?' 'Thất vọng hay khoai?' 'Cả hai.'\""
    ),
    ("rest", "slice_of_life"): (
        "🌙 Rest × Slice of Life:\n"
        "\"Lửa tí tách. Trời đầy sao — nhiều hơn bất kỳ đêm nào anh từng thấy ở "
        "thế giới cũ. Companion đưa một chén canh nóng. Không nói gì. Chỉ đưa. "
        "Anh uống. Mặn vừa. Ấm từ họng xuống bụng. "
        "Đôi khi thế giới mới đẹp khi nó không cố đẹp.\""
    ),
    ("rest", "mysterious"): (
        "🌙 Rest × Mysterious:\n"
        "\"Giấc mơ lại đến. Luôn là cùng một phòng — trắng, trống, một chiếc ghế. "
        "Và trên ghế, ai đó ngồi quay lưng. Anh gọi. Không quay. Anh bước tới — "
        "phòng dài ra. Mỗi bước: xa hơn. Rồi anh tỉnh. Và tay đang cầm thứ gì đó "
        "không có trong phòng trước khi ngủ.\""
    ),
}


def _build_tone_context(tone: str, scene_type: str = "") -> str:
    """Build tone context with optional scene-type-specific voice example."""
    base = ""
    if tone and tone in _TONE_DESC:
        base = _TONE_DESC[tone]
    else:
        base = "Tự do — cân bằng giữa các tone, ưu tiên phù hợp với preference tags."

    # Append scene-type-specific voice if available
    key = (scene_type, tone) if scene_type and tone else None
    if key and key in _SCENE_TONE_VOICE:
        base += f"\n\n{_SCENE_TONE_VOICE[key]}"

    return base


def _extract_player_context(player_state: dict | None) -> dict:
    """Extract identity fields from player state safely."""
    values, traits, motivation, power_style = "", "", "", ""
    if player_state:
        ci = player_state.get("current_identity", {})
        if isinstance(ci, dict):
            values = ", ".join(ci.get("active_values", []))
            traits = ", ".join(ci.get("active_traits", []))
            motivation = ci.get("current_motivation", "")
            power_style = ci.get("power_style", "")
        elif hasattr(ci, "active_values"):
            values = ", ".join(getattr(ci, "active_values", []))
            traits = ", ".join(getattr(ci, "active_traits", []))
            motivation = getattr(ci, "current_motivation", "")
            power_style = getattr(ci, "power_style", "")
    return {
        "values": values or "Chưa xác định",
        "traits": traits or "Chưa xác định",
        "motivation": motivation or "Chưa xác định",
        "power_style": power_style or "Chưa xác định",
    }


def _extract_skill_info(skill: dict | None) -> str:
    """Format unique skill info for prompt — structured for LLM clarity."""
    if not skill:
        return "Chưa có skill"

    name = skill.get("name", "Unknown")
    sections = []

    # ── Core Identity ──
    sections.append(f"### 🔮 {name}")
    if skill.get("description"):
        sections.append(f"**Bản chất:** {skill['description']}")
    if skill.get("category"):
        sections.append(f"**Phân loại:** {skill['category']}")

    # ── Mechanic & Activation ──
    if skill.get("mechanic"):
        sections.append(f"\n**Cơ chế hoạt động:** {skill['mechanic']}")
    if skill.get("activation_condition"):
        sections.append(f"**Điều kiện kích hoạt:** {skill['activation_condition']}")

    # ── CONSTRAINTS (Writer PHẢI tôn trọng) ──
    constraints = []
    if skill.get("limitation"):
        constraints.append(f"⚠️ Giới hạn: {skill['limitation']}")
    if skill.get("weakness"):
        constraints.append(f"⚠️ Điểm yếu: {skill['weakness']}")
    if skill.get("countered_by"):
        counters = skill["countered_by"]
        if isinstance(counters, list) and counters:
            constraints.append(f"⚠️ Bị khắc chế bởi: {', '.join(counters)}")

    if constraints:
        sections.append("\n**⛔ QUY TẮC BẮT BUỘC — Writer PHẢI tôn trọng:**")
        sections.extend(constraints)
        sections.append(
            "→ Nếu player dùng skill 2+ lần trong chapter, "
            "PHẢI thể hiện hậu quả (mệt mỏi, overuse, constraint bị chạm)."
        )

    # ── Narrative Guidance ──
    if skill.get("soul_resonance"):
        sections.append(f"\n**Cộng hưởng linh hồn:** {skill['soul_resonance']}")

    return "\n".join(sections)




def _validate_scene_choices(
    choices: list,
    scene_type: str,
    skill_name: str,
    skill_mechanic: str,
    skill_limitation: str = "",
) -> list:
    """Validate and auto-fix scene choices after LLM generation.

    Rules enforced:
    1. combat + discovery: guaranteed skill choice (auto-injected if AI misses)
    2. Risk levels should be diverse (not all identical)
    3. Skill choice format should match [Skill Name] — action
    """
    if not choices or not skill_name:
        return choices

    # ── 1. Check for skill choices ──
    has_skill_choice = any(
        f"[{skill_name}]" in c.text for c in choices
    )

    # Guaranteed injection for combat + discovery (AI can miss these)
    _must_inject = scene_type in ("combat", "discovery")
    if _must_inject and not has_skill_choice:
        risk = 4 if scene_type == "combat" else 3
        mechanic_short = skill_mechanic[:55] if skill_mechanic else "kích hoạt kỹ năng"

        # Consequence hints: natural narrative tone, no explicit warnings
        if scene_type == "combat":
            limitation_note = f" ({skill_limitation[:40]})" if skill_limitation else ""
            hint = f"Một cơ hội để thử {skill_name} trong combat{limitation_note}."
        else:  # discovery
            hint = f"Khoảnh khắc để khám phá giới hạn thực sự của {skill_name}."

        skill_choice = Choice(
            id=f"s{choices[0].id[1] if choices[0].id and len(choices[0].id) > 1 else '1'}c_skill",
            text=f"[{skill_name}] — {mechanic_short}",
            risk_level=risk,
            consequence_hint=hint,
        )
        choices[-1] = skill_choice
        logger.info(
            f"SceneValidator: {scene_type} scene missing skill choice — "
            f"auto-injected [{skill_name}] (risk={risk})"
        )

    # ── 2. Risk level diversity ──
    risk_levels = [c.risk_level for c in choices]
    if len(set(risk_levels)) == 1 and len(choices) >= 3:
        # All same risk → spread: low, mid, high
        choices[0].risk_level = 2
        choices[1].risk_level = 3
        choices[2].risk_level = 4
        logger.info(
            f"SceneValidator: all choices had risk={risk_levels[0]} — "
            f"spread to [2, 3, 4]"
        )

    # ── 3. Validate skill choice format ──
    for c in choices:
        if f"[{skill_name}]" in c.text:
            # Check for " — " separator
            if "—" not in c.text and "-" not in c.text:
                # Fix format: add separator after skill name bracket
                bracket_end = c.text.find("]") + 1
                action = c.text[bracket_end:].strip()
                if action:
                    c.text = f"[{skill_name}] — {action}"
                    logger.info(
                        f"SceneValidator: fixed skill choice format — "
                        f"added separator"
                    )

    return choices


async def run_scene_writer(input: SceneWriterInput) -> Scene:
    """Generate a single scene with prose and choices.

    Returns a Scene object ready to be saved to DB.
    """
    llm = _make_llm()
    identity = _extract_player_context(input.player_state)
    skill_info = _extract_skill_info(input.unique_skill)

    # Build beats overview with current marker
    beats_lines = []
    for i, b in enumerate(input.all_beats):
        marker = "→" if i == (input.scene_number - 1) else " "
        beats_lines.append(
            f"{marker} {i+1}. [{b.purpose}] [{b.scene_type}] "
            f"{b.description} (tension: {b.tension})"
        )
    all_beats_text = "\n".join(beats_lines)

    # Previous scene prose 2
    prev_prose_2_section = ""
    if input.previous_scene_prose_2:
        prev_prose_2_section = (
            f"## Prose scene N-2:\n{input.previous_scene_prose_2}"
        )

    # Build chosen choice text
    chosen_text = "Chưa có lựa chọn (scene đầu tiên)"
    if input.chosen_choice:
        c = input.chosen_choice
        chosen_text = f'"{c.text}" (risk: {c.risk_level})'
        if c.consequence_hint:
            chosen_text += f"\nHint: {c.consequence_hint}"

    # Critic feedback
    critic_section = ""
    if input.critic_feedback:
        critic_section = f"## ⚠️ Critic Feedback:\n{input.critic_feedback}"

    # Skill activation check (code-enforced failure mechanic)
    usage = input.skill_usage_this_chapter
    overuse_warning = ""
    if input.unique_skill and usage > 0:
        from app.engine.skill_check import check_skill_activation
        _res = input.unique_skill.get("resilience", 100.0) if isinstance(input.unique_skill, dict) else 100.0
        _si = input.unique_skill.get("instability", 0.0) if isinstance(input.unique_skill, dict) else 0.0
        _ps = (input.player_state or {}).get("stability", 100.0) if isinstance(input.player_state, dict) else 100.0
        _pi = (input.player_state or {}).get("instability", 0.0) if isinstance(input.player_state, dict) else 0.0
        activation = check_skill_activation(
            resilience=_res,
            skill_instability=_si,
            player_stability=_ps,
            usage_this_chapter=usage,
            player_instability=_pi,
        )
        overuse_warning = activation.narrative_instruction

    # Compute explicit skill choice recommendation signal
    skill_choice_guidance = _build_skill_choice_guidance(
        scene_type=input.beat.scene_type,
        tension=input.beat.tension,
        beat_description=input.beat.description,
        skill=input.unique_skill if isinstance(input.unique_skill, dict) else None,
        skill_usage=usage,
    )

    messages = [
        SystemMessage(content=_FULL_SYSTEM_PROMPT),
        HumanMessage(content=_USER_TEMPLATE.format(
            chapter_number=input.chapter_number,
            scene_number=input.scene_number,
            total_scenes=input.total_scenes,
            protagonist_name=input.protagonist_name or "Nhân vật chính",
            npc_address=_get_npc_address(input.gender),
            preference_tags=", ".join(input.preference_tags or ["general"]),
            beat_description=input.beat.description,
            beat_tension=input.beat.tension,
            beat_purpose=input.beat.purpose,
            scene_type=input.beat.scene_type,
            beat_mood=input.beat.mood,
            is_chapter_end=input.is_chapter_end,
            all_beats_text=all_beats_text,
            prev_scene_num=input.scene_number - 1,
            previous_scene_prose=input.previous_scene_prose or "Chưa có (scene đầu tiên)",
            previous_scene_prose_2_section=prev_prose_2_section,
            chosen_choice_text=chosen_text,
            values=identity["values"],
            traits=identity["traits"],
            motivation=identity["motivation"],
            power_style=identity["power_style"],
            skill_info=skill_info,
            skill_choice_guidance=skill_choice_guidance,
            skill_usage_this_chapter=usage,
            skill_overuse_warning=overuse_warning,
            fate_instruction=input.fate_instruction or "Không có chỉ dẫn",
            critic_feedback=critic_section,
            semantic_context=input.semantic_context or "Không có ký ức liên quan.",
            combat_context=_format_combat_brief(input.combat_brief),
            evolution_context=input.evolution_context or "Không có sự kiện evolution.",
            resonance_context=input.resonance_context or "Chưa có dữ liệu resonance.",
            weapon_context=_format_weapon_context(input.combat_brief, input.weapon_context),
            adaptive_context=input.adaptive_context or "Không có adaptive context.",
            tone_context=_build_tone_context(input.tone, input.beat.scene_type),
            tag_guidance=_build_tag_guidance(input.preference_tags),
        )),
    ]

    logger.info(
        f"SceneWriter: chapter {input.chapter_number} "
        f"scene {input.scene_number}/{input.total_scenes} "
        f"(type={input.beat.scene_type})"
    )

    response = await llm.ainvoke(messages)
    raw_content = response.content
    result = _parse_scene_json(raw_content)

    logger.info(
        f"SceneWriter: parsed result keys: {list(result.keys())}, "
        f"choices count: {len(result.get('choices', []))}"
    )
    if not result.get('choices'):
        logger.warning(
            f"SceneWriter: NO CHOICES parsed! Raw output (last 500 chars): "
            f"{raw_content[-500:]}"
        )

    # Parse choices
    choices = []
    for c in result.get("choices", []):
        if isinstance(c, dict):
            choices.append(Choice(
                id=c.get("id", ""),
                text=c.get("text", ""),
                risk_level=c.get("risk_level", 3),
                consequence_hint=c.get("consequence_hint", ""),
            ))

    # Ensure exactly 3 choices with varied fallbacks
    _fallback_choices = [
        Choice(
            text="Thận trọng quan sát xung quanh",
            risk_level=1,
            consequence_hint="An toàn nhưng có thể bỏ lỡ cơ hội",
        ),
        Choice(
            text="Tiến lên phía trước",
            risk_level=3,
            consequence_hint="Có thể phát hiện điều bất ngờ",
        ),
        Choice(
            text="Tìm một con đường khác",
            risk_level=2,
            consequence_hint="Khám phá thêm nhưng mất thời gian",
        ),
    ]
    for i in range(len(choices), 3):
        choices.append(_fallback_choices[i])

    # ── Post-generation validation ──
    choices = _validate_scene_choices(
        choices=choices,
        scene_type=input.beat.scene_type,
        skill_name=(input.unique_skill or {}).get("name", ""),
        skill_mechanic=(input.unique_skill or {}).get("mechanic", ""),
        skill_limitation=(input.unique_skill or {}).get("limitation", ""),
    )

    scene = Scene(
        scene_number=input.scene_number,
        beat_index=input.scene_number - 1,
        title=result.get("scene_title", ""),
        prose=result.get("prose", ""),
        choices=choices[:3],
        scene_type=input.beat.scene_type,
        is_chapter_end=input.is_chapter_end,
        tension=input.beat.tension,
        mood=input.beat.mood,
    )

    logger.info(
        f"SceneWriter: scene {input.scene_number} done — "
        f"{len(scene.prose)} chars, {len(scene.choices)} choices"
    )

    return scene


# ──────────────────────────────────────────────
# JSON parsing — reuses strategies from writer.py
# ──────────────────────────────────────────────

def _parse_scene_json(raw: str) -> dict:
    """Parse scene writer JSON output with multiple fallback strategies."""
    # Strip markdown fences
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # Strategy 1: Direct parse
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    # Strategy 2: Fix unescaped newlines
    try:
        fixed = _fix_json_newlines(text)
        data = json.loads(fixed)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    # Strategy 3: Extract balanced braces
    try:
        extracted = _extract_balanced_json(text)
        if extracted:
            data = json.loads(extracted)
            if isinstance(data, dict):
                return data
    except json.JSONDecodeError:
        pass

    # Strategy 4: Regex fallback
    logger.warning("SceneWriter: all JSON strategies failed, using regex fallback")
    return _extract_scene_fields_regex(text)


def _fix_json_newlines(text: str) -> str:
    """Fix unescaped newlines inside JSON string values."""
    import re
    result = []
    in_string = False
    escape_next = False
    for char in text:
        if escape_next:
            result.append(char)
            escape_next = False
            continue
        if char == '\\':
            result.append(char)
            escape_next = True
            continue
        if char == '"':
            in_string = not in_string
        if in_string and char == '\n':
            result.append('\\n')
            continue
        result.append(char)
    return ''.join(result)


def _extract_balanced_json(text: str) -> str | None:
    """Extract first balanced { ... } block."""
    start = text.find('{')
    if start == -1:
        return None
    depth = 0
    for i, c in enumerate(text[start:], start):
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def _extract_scene_fields_regex(text: str) -> dict:
    """Extract scene fields using regex as last resort."""
    import re
    result = {}

    # Extract prose
    prose_match = re.search(r'"prose"\s*:\s*"((?:[^"\\]|\\.)*)?"', text, re.DOTALL)
    if prose_match:
        result["prose"] = prose_match.group(1).replace('\\n', '\n').replace('\\"', '"')

    # Extract scene_title
    title_match = re.search(r'"scene_title"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
    if title_match:
        result["scene_title"] = title_match.group(1)

    # Extract choices array
    choices_match = re.search(r'"choices"\s*:\s*\[(.*?)\]', text, re.DOTALL)
    if choices_match:
        try:
            choices_text = "[" + choices_match.group(1) + "]"
            choices_text = _fix_json_newlines(choices_text)
            result["choices"] = json.loads(choices_text)
        except json.JSONDecodeError:
            result["choices"] = []

    return result
