"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
    Brain,
    Timer,
    ClipboardList,
    BookOpen,
    Link2,
    ShieldCheck,
    ExternalLink,
    Keyboard,
    Music,
    RefreshCw,
} from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"
import { FeatureWorkflowModal, type FeatureWithWorkflow } from "./feature-workflow-modal"

const features: FeatureWithWorkflow[] = [
    {
        icon: Brain,
        titleEn: "Active Reading AI",
        titleVi: "AI Đọc Chủ động",
        descEn:
            "Highlight any text on any webpage → AI instantly analyzes, summarizes, and explains it right in his sidepanel. Your personal tutor for every article.",
        descVi:
            "Highlight bất kỳ đoạn nào trên web → AI phân tích, tóm tắt, giải thích ngay trong sidepanel. Gia sư cá nhân cho mọi bài viết.",
        gradient: "from-violet-500/20 to-purple-500/10",
        tag: "Core",
        stepEmojis: ["🖱️", "🧠", "💬", "💾"],
        stepsEn: [
            "Highlight any text on any webpage you're reading",
            "AI instantly analyzes and summarizes the selected passage in the sidepanel",
            "Ask follow-up questions or request deeper explanations",
            "Save key insights to your personal knowledge base",
        ],
        stepsVi: [
            "Highlight bất kỳ đoạn text nào trên trang web đang đọc",
            "AI tự động phân tích và tóm tắt đoạn được chọn trong sidepanel",
            "Hỏi thêm chi tiết hoặc yêu cầu giải thích sâu hơn",
            "Lưu insights quan trọng vào kho kiến thức cá nhân",
        ],
        tipEn: "Press Ctrl+Shift+S to instantly open the sidepanel while reading any article.",
        tipVi: "Nhấn Ctrl+Shift+S để mở nhanh sidepanel khi đang đọc bất kỳ bài viết nào.",
    },
    {
        icon: Timer,
        titleEn: "Focus Timer",
        titleVi: "Hẹn giờ Tập trung",
        descEn:
            "Built-in Pomodoro timer with 25/40/50 min presets. After each session, AI surfaces key insights you read — helping you retain more.",
        descVi:
            "Pomodoro tích hợp với preset 25/40/50 phút. Sau mỗi phiên, AI gợi lại những insight quan trọng — giúp bạn nhớ lâu hơn.",
        gradient: "from-amber-500/20 to-orange-500/10",
        tag: "Productivity",
        stepEmojis: ["⏱️", "📖", "🔔", "📋"],
        stepsEn: [
            "Choose a focus preset: 25, 40, or 50 minutes from the popup",
            "Read and browse normally — AmoNexus tracks your highlights in the background",
            "When the timer ends, you'll get a gentle notification",
            "AI shows a recap of key insights you read during the session",
        ],
        stepsVi: [
            "Chọn preset tập trung: 25, 40 hoặc 50 phút từ popup",
            "Đọc và duyệt web bình thường — AmoNexus theo dõi highlights ở background",
            "Khi hết giờ, bạn sẽ nhận thông báo nhẹ nhàng",
            "AI hiển thị tóm tắt các insights bạn đã đọc trong phiên",
        ],
        tipEn: "You can also set a custom timer duration up to 120 minutes.",
        tipVi: "Bạn cũng có thể đặt thời gian tuỳ chỉnh lên đến 120 phút.",
    },
    {
        icon: ClipboardList,
        titleEn: "Smart Research Queue",
        titleVi: "Hàng đợi Nghiên cứu",
        descEn:
            "Save highlights as research cards, auto-grouped by topic. Build a structured knowledge base as you browse — no manual organizing needed.",
        descVi:
            "Lưu highlights thành thẻ nghiên cứu, tự nhóm theo chủ đề. Xây dựng kho kiến thức có cấu trúc ngay khi duyệt web — không cần sắp xếp thủ công.",
        gradient: "from-cyan-500/20 to-blue-500/10",
        tag: "Research",
        stepEmojis: ["✨", "📑", "🗂️", "📤"],
        stepsEn: [
            "Highlight important text while browsing any webpage",
            "Click 'Save' to add the highlight to your research queue",
            "Cards are auto-grouped into batches by topic — no manual sorting",
            "Export batches for review or send to NotebookLM",
        ],
        stepsVi: [
            "Highlight đoạn text quan trọng khi duyệt bất kỳ trang web nào",
            "Click 'Lưu' để thêm highlight vào hàng đợi nghiên cứu",
            "Thẻ tự động nhóm thành batch theo chủ đề — không cần sắp xếp",
            "Xuất batch để ôn tập hoặc gửi sang NotebookLM",
        ],
        tipEn: "Research cards preserve the source URL so you can always go back to the original context.",
        tipVi: "Thẻ nghiên cứu giữ URL nguồn để bạn luôn có thể quay lại ngữ cảnh gốc.",
    },
    {
        icon: BookOpen,
        titleEn: "AI Journal",
        titleVi: "Nhật ký AI",
        descEn:
            "Write daily reflections and get thoughtful AI responses that help you think deeper. Your private space for contemplation and growth.",
        descVi:
            "Viết nhật ký hàng ngày và nhận phản hồi sâu sắc từ AI giúp bạn suy nghĩ sâu hơn. Không gian riêng tư để chiêm nghiệm và phát triển.",
        gradient: "from-pink-500/20 to-rose-500/10",
        tag: "Reflection",
        stepEmojis: ["✏️", "🤖", "📚", "🔍"],
        stepsEn: [
            "Open the Journal tab and write your thoughts or reflections",
            "AI responds with thoughtful questions and insights to help you think deeper",
            "Your entries are saved locally — completely private",
            "Browse past entries to track your growth over time",
        ],
        stepsVi: [
            "Mở tab Nhật ký và viết suy nghĩ hoặc cảm nhận của bạn",
            "AI phản hồi với câu hỏi sâu sắc giúp bạn suy nghĩ kỹ hơn",
            "Các mục nhật ký được lưu nội bộ — hoàn toàn riêng tư",
            "Xem lại các mục cũ để theo dõi sự phát triển của bạn",
        ],
        tipEn: "Use the Quick Diary widget in the sidepanel for quick daily entries without switching tabs.",
        tipVi: "Dùng widget Nhật ký nhanh trong sidepanel để viết mỗi ngày mà không cần chuyển tab.",
    },
    {
        icon: Link2,
        titleEn: "Neural Memory",
        titleVi: "Bộ nhớ Neural",
        descEn:
            "A semantic memory system that connects your saved insights across topics. Search by meaning, not keywords — find what you need instantly.",
        descVi:
            "Hệ thống bộ nhớ ngữ nghĩa kết nối insights xuyên chủ đề. Tìm kiếm theo ý nghĩa, không bằng từ khóa — tìm ngay thứ bạn cần.",
        gradient: "from-emerald-500/20 to-teal-500/10",
        tag: "Memory",
        stepEmojis: ["💾", "🧬", "🔎", "🔗"],
        stepsEn: [
            "Save highlights and notes — they're automatically stored as semantic memories",
            "Enable Semantic Embeddings in the menu for AI-powered memory connections",
            "Use Semantic Search to find memories by meaning, not exact keywords",
            "Discover related insights across different topics and reading sessions",
        ],
        stepsVi: [
            "Lưu highlights và ghi chú — chúng tự động được lưu dưới dạng bộ nhớ ngữ nghĩa",
            "Bật Semantic Embeddings trong menu để kết nối bộ nhớ bằng AI",
            "Dùng Semantic Search để tìm bộ nhớ theo ý nghĩa, không cần từ khoá chính xác",
            "Khám phá insights liên quan xuyên các chủ đề và phiên đọc",
        ],
        tipEn: "Memories with higher relevance scores are reinforced — the more you revisit a page, the stronger the memory.",
        tipVi: "Bộ nhớ có điểm liên quan cao sẽ được củng cố — bạn càng quay lại trang, bộ nhớ càng mạnh.",
    },
    {
        icon: ShieldCheck,
        titleEn: "Safe Zone",
        titleVi: "Vùng An toàn",
        descEn:
            "Mark sensitive domains as safe zones where AmoNexus won't track or analyze. Full privacy control, one click.",
        descVi:
            "Đánh dấu domain nhạy cảm là vùng an toàn — AmoNexus sẽ không theo dõi hay phân tích. Toàn quyền riêng tư, chỉ một click.",
        gradient: "from-blue-500/20 to-indigo-500/10",
        tag: "Privacy",
        stepEmojis: ["🛡️", "🔒", "✅", "⚙️"],
        stepsEn: [
            "Visit any website where you want privacy protection",
            "Click the AmoNexus popup and toggle 'Safe Zone' for that domain",
            "AmoNexus immediately stops all tracking and analysis on that site",
            "Manage your safe zone list anytime in Settings",
        ],
        stepsVi: [
            "Truy cập bất kỳ trang web nào bạn muốn bảo vệ quyền riêng tư",
            "Click popup AmoNexus và bật 'Vùng An toàn' cho domain đó",
            "AmoNexus ngay lập tức ngừng mọi theo dõi và phân tích trên site đó",
            "Quản lý danh sách vùng an toàn bất cứ lúc nào trong Settings",
        ],
        tipEn: "Banking sites, personal email, and social media are great candidates for safe zones.",
        tipVi: "Trang ngân hàng, email cá nhân và mạng xã hội là ứng viên tốt cho vùng an toàn.",
    },
    {
        icon: ExternalLink,
        titleEn: "NotebookLM Bridge",
        titleVi: "Cầu nối NotebookLM",
        descEn:
            "Export your reading sessions and insights directly to Google NotebookLM. Seamless integration for serious researchers.",
        descVi:
            "Xuất phiên đọc và insights trực tiếp sang Google NotebookLM. Tích hợp liền mạch cho nhà nghiên cứu nghiêm túc.",
        gradient: "from-sky-500/20 to-blue-500/10",
        tag: "Export",
        stepEmojis: ["📖", "📋", "🚀", "📓"],
        stepsEn: [
            "Complete a reading session with highlights and AI conversations",
            "Open the menu and click 'Save All to Knowledge' or export options",
            "Choose 'Send to NotebookLM' to open your session in Google NotebookLM",
            "Your highlights and notes appear as a formatted source in NotebookLM",
        ],
        stepsVi: [
            "Hoàn thành phiên đọc với highlights và hội thoại AI",
            "Mở menu và click 'Lưu tất cả vào Kiến thức' hoặc tuỳ chọn xuất",
            "Chọn 'Gửi sang NotebookLM' để mở phiên trong Google NotebookLM",
            "Highlights và ghi chú xuất hiện dưới dạng nguồn có format trong NotebookLM",
        ],
        tipEn: "You can also download notes as Markdown or plain text files for offline use.",
        tipVi: "Bạn cũng có thể tải ghi chú dưới dạng Markdown hoặc file text để dùng offline.",
    },
    {
        icon: Keyboard,
        titleEn: "Quick Shortcut",
        titleVi: "Phím tắt Nhanh",
        descEn:
            "Press Ctrl+Shift+S anytime to instantly open the sidepanel. No searching through menus — your second brain is always one keystroke away.",
        descVi:
            "Nhấn Ctrl+Shift+S bất cứ lúc nào để mở sidepanel. Không cần tìm trong menu — bộ não thứ hai luôn chỉ một phím bấm.",
        gradient: "from-slate-500/20 to-gray-500/10",
        tag: "Utility",
        stepEmojis: ["⌨️", "⚡", "📌", "🎯"],
        stepsEn: [
            "Press Ctrl+Shift+S (or Cmd+Shift+S on Mac) on any webpage",
            "The sidepanel opens instantly — no clicking through menus",
            "Start chatting, highlighting, or reviewing immediately",
            "Press the shortcut again or click X to close when done",
        ],
        stepsVi: [
            "Nhấn Ctrl+Shift+S (hoặc Cmd+Shift+S trên Mac) trên bất kỳ trang web nào",
            "Sidepanel mở ngay lập tức — không cần click qua menu",
            "Bắt đầu chat, highlight hoặc ôn tập ngay lập tức",
            "Nhấn lại phím tắt hoặc click X để đóng khi xong",
        ],
        tipEn: "You can customize the shortcut key in Chrome's extension settings: chrome://extensions/shortcuts",
        tipVi: "Bạn có thể tuỳ chỉnh phím tắt trong cài đặt extension Chrome: chrome://extensions/shortcuts",
    },
    {
        icon: Music,
        titleEn: "AmoLofi Sync Bridge",
        titleVi: "Cầu nối AmoLofi",
        descEn:
            "Seamlessly connect with AmoLofi (lofi.amonexus.com) — a lo-fi music & ambient web app. Focus Session state syncs in real-time between Extension and Web App.",
        descVi:
            "Kết nối liền mạch với AmoLofi (lofi.amonexus.com) — ứng dụng nhạc lo-fi & ambient. Trạng thái Focus Session đồng bộ real-time giữa Extension và Web App.",
        gradient: "from-rose-500/20 to-pink-500/10",
        tag: "v4.0 NEW",
        stepEmojis: ["🎵", "🔗", "⏱️", "✨"],
        stepsEn: [
            "Open lofi.amonexus.com — your ambient focus music web app",
            "Sign in with Google (same account as the extension)",
            "Start a Focus Session on either platform",
            "Timer state syncs in real-time — Extension ↔ Web App",
        ],
        stepsVi: [
            "Mở lofi.amonexus.com — ứng dụng nhạc ambient tập trung",
            "Đăng nhập bằng Google (cùng tài khoản với extension)",
            "Bắt đầu Focus Session trên bất kỳ nền tảng nào",
            "Trạng thái timer đồng bộ real-time — Extension ↔ Web App",
        ],
        tipEn: "Play lo-fi ambient music on AmoLofi while focusing with AmoNexus for the ultimate flow state.",
        tipVi: "Phát nhạc lo-fi ambient trên AmoLofi khi tập trung với AmoNexus để đạt trạng thái flow tối ưu.",
    },
    {
        icon: RefreshCw,
        titleEn: "Cross-Platform Auth Sync",
        titleVi: "Đồng bộ Đăng nhập",
        descEn:
            "Sign in once — either on the Extension or AmoLofi Web — and your session is automatically shared across both platforms. No double login needed.",
        descVi:
            "Đăng nhập một lần — trên Extension hoặc AmoLofi Web — phiên của bạn tự động được chia sẻ giữa cả hai nền tảng. Không cần đăng nhập hai lần.",
        gradient: "from-teal-500/20 to-cyan-500/10",
        tag: "v4.0 NEW",
        stepEmojis: ["🔐", "🔄", "🌐", "✅"],
        stepsEn: [
            "Sign in with Google on either the Extension or lofi.amonexus.com",
            "Your authentication is automatically synced to the other platform",
            "Open AmoLofi Web — you're already logged in",
            "All features (Lofi Sync, AI Scenes) work immediately",
        ],
        stepsVi: [
            "Đăng nhập Google trên Extension hoặc lofi.amonexus.com",
            "Xác thực tự động đồng bộ sang nền tảng còn lại",
            "Mở AmoLofi Web — bạn đã đăng nhập sẵn",
            "Tất cả tính năng (Lofi Sync, AI Scenes) hoạt động ngay",
        ],
        tipEn: "Auth sync happens securely — tokens are only shared between our domains (*.amonexus.com).",
        tipVi: "Đồng bộ auth diễn ra an toàn — tokens chỉ được chia sẻ giữa các domain của chúng tôi (*.amonexus.com).",
    },
]

export function WhatsNewFeatures() {
    const { t } = useLanguage()
    const { theme } = useTheme()
    const [selectedFeature, setSelectedFeature] = useState<FeatureWithWorkflow | null>(null)

    return (
        <section className="py-24 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
                        {t(
                            <>
                                Everything in <span className="text-primary">v4.0</span>
                            </>,
                            <>
                                Tất cả trong <span className="text-primary">v4.0</span>
                            </>,
                        )}
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        {t(
                            "10 powerful features designed to make you a more effective learner and thinker.",
                            "10 tính năng mạnh mẽ giúp bạn trở thành người học và người tư duy hiệu quả hơn.",
                        )}
                    </p>
                </motion.div>

                {/* Bento Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.titleEn}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.08 }}
                            className={`group relative cursor-pointer ${index === 0 || index === 3 ? "lg:col-span-2" : ""
                                }`}
                            onClick={() => setSelectedFeature(feature)}
                        >
                            {/* Hover glow */}
                            <div
                                className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/40 group-hover:via-primary/20 group-hover:to-primary/40 opacity-0 group-hover:opacity-100 transition-all duration-500 blur-sm"
                            />

                            {/* Card */}
                            <div
                                className={`relative h-full p-6 md:p-7 rounded-2xl border border-border ${theme === "dark" ? "bg-card" : "bg-card"
                                    } backdrop-blur-sm group-hover:border-primary/30 transition-colors duration-300`}
                            >
                                {/* Background gradient */}
                                <div
                                    className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                                />

                                {/* Content */}
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <div
                                            className={`w-11 h-11 rounded-xl ${theme === "dark" ? "bg-secondary" : "bg-secondary"
                                                } flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300`}
                                        >
                                            <feature.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                                        </div>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 py-1 rounded-full border border-border/50">
                                            {feature.tag}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground mb-2">
                                        {t(feature.titleEn, feature.titleVi)}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {t(feature.descEn, feature.descVi)}
                                    </p>

                                    {/* "Click to learn more" hint */}
                                    <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground/40 group-hover:text-primary/60 transition-colors duration-300">
                                        <span>{t("Click to see workflow", "Click để xem hướng dẫn")}</span>
                                        <span className="group-hover:translate-x-1 transition-transform duration-300">→</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Workflow Modal */}
                <FeatureWorkflowModal
                    feature={selectedFeature}
                    isOpen={!!selectedFeature}
                    onClose={() => setSelectedFeature(null)}
                />
            </div>
        </section>
    )
}
