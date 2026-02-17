"use client"

import { LanguageProvider, useLanguage } from "@/lib/language-context"
import { ThemeProvider } from "@/lib/theme-context"
import { Footer } from "@/components/footer"
import { ArrowLeft, Download } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

function WhitepaperContent() {
    const { language } = useLanguage()
    const isEn = language === "en"

    return (
        <main className="min-h-screen bg-background text-foreground selection:bg-primary/20">
            <div className="container mx-auto px-4 py-12 max-w-4xl">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    {isEn ? "Back to Home" : "Về Trang Chủ"}
                </Link>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                            AmoNexus Whitepaper
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            {isEn ? "The Architecture of Mindful Technology" : "Kiến trúc Công nghệ Tỉnh thức"}
                        </p>
                    </div>
                    <Button className="gap-2" variant="outline">
                        <Download className="w-4 h-4" />
                        {isEn ? "Download PDF" : "Tải PDF"}
                    </Button>
                </div>

                <article className="prose prose-zinc dark:prose-invert max-w-none">
                    {/* 1. Executive Summary */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4">1. Executive Summary</h2>
                        <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20">
                            <p className="leading-relaxed m-0 text-muted-foreground">
                                {isEn
                                    ? "ATOM is a Chrome Extension (Manifest V3) that detects prolonged, high-momentum browsing sessions and responds with the least intrusive intervention first: a subtle presence signal, a lightweight “micro-closure” prompt, and only then a stronger “hard interrupt” mode. The system is implemented as a deterministic pipeline running locally in the extension: content scripts measure user interaction signals, the background service worker enriches signals with recent intervention/reaction history, then a multi-stage decision stack selects an intervention category and renders UI in-page. ATOM also logs user reactions (e.g., COMPLETED / SNOOZED / IGNORED) to model “resistance” and unlock escalation when gentle prompts are repeatedly ignored. An optional online AI path exists for journaling analysis via Gemini; this introduces privacy considerations that must be documented precisely. Overall, ATOM’s architecture favors local processing, explicit cooldowns, and state cleanup to remain MV3-reliable while enabling personalization through reaction history."
                                    : "ATOM là một Chrome Extension (Manifest V3) phát hiện phiên lướt web kéo dài / “trôi” theo quán tính và phản hồi theo nguyên tắc “ít xâm lấn trước”: tín hiệu hiện diện (presence), “micro-closure” (nhắc nhẹ 2 nút), và chỉ leo thang sang “hard interrupt” khi người dùng kháng cự. Hệ thống được triển khai dưới dạng pipeline chạy trong extension: content script đo tín hiệu tương tác, background service worker bổ sung lịch sử can thiệp/ phản ứng, sau đó một tầng quyết định nhiều bước chọn “category” rồi render UI ngay trên trang. ATOM ghi log phản ứng (COMPLETED / SNOOZED / IGNORED) để tính “resistance” và kích hoạt escalation khi micro-closure bị phớt lờ nhiều lần. Ngoài ra có nhánh AI online (Gemini) để phân tích nhật ký; nhánh này cần mô tả privacy cực rõ. Tổng thể, ATOM ưu tiên xử lý cục bộ, có cooldown, và cleanup UI đúng kiểu MV3."
                                }
                            </p>
                        </div>
                    </section>

                    {/* 2. Problem & Insight */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4">2. Problem & Insight</h2>

                        <h3 className="text-xl font-semibold mt-6 mb-2">{isEn ? "The Problem" : "Vấn đề"}</h3>
                        <p className="text-muted-foreground mb-4">
                            {isEn
                                ? "Modern feeds optimize for continuous engagement; users often notice “doomscrolling” only after minutes have passed. Any intervention that is too aggressive early will be dismissed; too gentle too late is ineffective."
                                : "Các feed tối ưu cho tương tác liên tục; người dùng thường chỉ “tỉnh ra” sau vài phút. Can thiệp quá mạnh sớm sẽ bị phản kháng; quá nhẹ muộn thì vô tác dụng."
                            }
                        </p>

                        <h3 className="text-xl font-semibold mt-6 mb-2">{isEn ? "Target Users" : "Nhóm người dùng"}</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            {isEn ? (
                                <>
                                    <li>Users who want gentle accountability while browsing social/content sites.</li>
                                    <li>Users who dislike heavy blockers but still want a backstop.</li>
                                    <li>Users who respond better to “companion presence” than punitive restriction.</li>
                                </>
                            ) : (
                                <>
                                    <li>Người muốn “nhắc nhẹ có trách nhiệm” khi lướt web.</li>
                                    <li>Người không thích chặn cứng ngay từ đầu.</li>
                                    <li>Người hợp với “companion presence” hơn là chế tài.</li>
                                </>
                            )}
                        </ul>

                        <h3 className="text-xl font-semibold mt-6 mb-2">{isEn ? "Why Now (Code-grounded)" : "Tại sao bây giờ?"}</h3>
                        <p className="text-muted-foreground">
                            {isEn
                                ? "Manifest V3 makes reliability/state management non-trivial; AmoNexus explicitly designs around MV3 constraints (service worker wake/sleep, storage restore) and includes cooldown + fail-safe silence behavior."
                                : "Manifest V3 khiến việc quản lý trạng thái trở nên phức tạp; AmoNexus thiết kế xoay quanh các ràng buộc của MV3 (service worker wake/sleep, storage restore) và bao gồm cơ chế cooldown + fail-safe silence."
                            }
                        </p>
                    </section>

                    {/* 3. Solution Overview */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4">3. Solution Overview</h2>
                        <p className="text-muted-foreground mb-4">
                            {isEn
                                ? "AmoNexus implements a least-intrusive-first ladder:"
                                : "AmoNexus triển khai thang “leo thang tối thiểu”:"
                            }
                        </p>
                        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
                            {isEn ? (
                                <>
                                    <li>Decide whether to intervene at all (Guard).</li>
                                    <li>If intervene: choose intent/intensity/risk tolerance (Brain).</li>
                                    <li>Select an intervention category with exclusion rules (Curator).</li>
                                    <li>Render UI and log reactions for learning (Actor).</li>
                                </>
                            ) : (
                                <>
                                    <li>Quyết định có can thiệp không (Guard).</li>
                                    <li>Nếu có: chọn chiến thuật intent/intensity/risk tolerance (Brain).</li>
                                    <li>Chọn category theo luật loại trừ (Curator).</li>
                                    <li>Render UI + log phản ứng để học (Actor).</li>
                                </>
                            )}
                        </ol>
                        <div className="bg-muted p-4 rounded-lg mt-4 text-sm font-mono text-muted-foreground">
                            Trace: background.js::handleTick → SignalExtractor → DecisionEngine → StrategyLayer → SelectionLogic → InterventionManager
                        </div>
                    </section>

                    {/* 4. Product UX */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4">4. Product UX & Interventions</h2>

                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="p-6 rounded-xl border border-border bg-card">
                                <h3 className="font-semibold text-lg mb-3">Categories</h3>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li><strong>micro_closure:</strong> {isEn ? "2-button pill UI (Finish / Snooze)" : "UI pill 2 nút (Dừng / Để sau)"}</li>
                                    <li><strong>hard_interrupt:</strong> {isEn ? "Strong modes (BREATH, TAP, STILLNESS)" : "Can thiệp mạnh (Thở, Chạm, Tĩnh lặng)"}</li>
                                    <li><strong>presence_signal:</strong> {isEn ? "Orb layer based on silence rules" : "Lớp Orb theo luật im lặng"}</li>
                                    <li><strong>gentle_reflection:</strong> {isEn ? "Strategy intent affecting copy" : "Intent ảnh hưởng nội dung"}</li>
                                </ul>
                            </div>

                            <div className="p-6 rounded-xl border border-border bg-card">
                                <h3 className="font-semibold text-lg mb-3">Micro-closure UX</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {isEn ? "Floating pill with 'Finish' and 'Snooze' actions." : "Pill nổi với hành động 'Dừng' và 'Để sau'."}
                                </p>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    <p>• {isEn ? "Finish → LOG: COMPLETED" : "Dừng → LOG: COMPLETED"}</p>
                                    <p>• {isEn ? "Snooze → LOG: SNOOZED" : "Để sau → LOG: SNOOZED"}</p>
                                    <p>• {isEn ? "Scroll > 300px → LOG: IGNORED" : "Cuộn > 300px → LOG: IGNORED"}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 5. Architecture */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4">5. Architecture Overview</h2>
                        <p className="text-muted-foreground mb-6">
                            {isEn ? "High-level modules and decision pipeline." : "Các module cấp cao và pipeline quyết định."}
                        </p>

                        <div className="p-6 bg-muted/30 rounded-xl mb-6 overflow-x-auto">
                            {/* Mermaid diagram representation */}
                            <pre className="text-sm font-mono text-muted-foreground">
                                {`content.js (Signals + UI) 
  --> background.js (Service Worker Pipeline)
      --> core_logic.js (Extractor + Decision)
      --> strategy_layer.js
      --> selection_logic.js
      --> intervention_manager.js
          --> content.js (Render UI)
              --> LOG_REACTION --> background.js --> Storage`}
                            </pre>
                        </div>
                    </section>

                    {/* 6. Decision Logic */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4">6. Decision Logic & Intelligence</h2>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold mb-2">6.1 StrategyLayer</h3>
                                <p className="text-muted-foreground">
                                    {isEn
                                        ? "Escalation stats are computed in background. If attention_risk + highResistance + highMomentum + cooldown OK → Strategy elevates to 'aggressive' risk tolerance and 'high' intensity."
                                        : "Escalation được tính trong background. Nếu attention_risk + highResistance + highMomentum + cooldown OK → Strategy tăng lên 'aggressive' và intensity 'high'."
                                    }
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold mb-2">6.2 SelectionLogic</h3>
                                <p className="text-muted-foreground">
                                    {isEn
                                        ? "Exclusion rules prune candidates. Example: High fatigue blocks aggressive categories. 'Anti-meh' prevents repeating the same recent category."
                                        : "Luật loại trừ lọc bớt candidates. Ví dụ: Fatigue cao chặn category aggressive. 'Anti-meh' tránh lặp lại cùng loại category gần nhất."
                                    }
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 7. Data & Privacy */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4">7. Data & Privacy by Design</h2>
                        <div className="p-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                            <h3 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-4">
                                {isEn ? "Key Data Handling" : "Xử lý Dữ liệu Chính"}
                            </h3>
                            <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
                                <li>
                                    <strong>{isEn ? "Local Storage:" : "Lưu trữ nội bộ:"}</strong> {isEn ? "Reactions, journal logs, whitelist stored locally in browser." : "Reactions, nhật ký, whitelist lưu trong trình duyệt."}
                                </li>
                                <li>
                                    <strong>{isEn ? "Online AI (Optional):" : "AI Online (Tùy chọn):"}</strong> {isEn ? "Journaling notes are sent to Google Gemini only if configured. Privacy policy must enumerate transmitted fields." : "Ghi chú nhật ký chỉ gửi Google Gemini nếu được cấu hình. Chính sách quyền riêng tư phải liệt kê rõ các trường gửi đi."}
                                </li>
                                <li>
                                    <strong>{isEn ? "Permissions:" : "Quyền hạn:"}</strong> {isEn ? "Storage (persistence), Tabs (reload whitelist), Host Permissions (Gemini analysis)." : "Storage (lưu trữ), Tabs (tải lại whitelist), Host Permissions (phân tích Gemini)."}
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* 10. Roadmap */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-6">10. Roadmap</h2>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="p-4 rounded-lg border border-border bg-card">
                                <h4 className="font-semibold mb-2 text-primary">0–3 {isEn ? "Months" : "Tháng"}</h4>
                                <p className="text-sm text-muted-foreground">
                                    {isEn ? "Stability + Correctness. Automated tests, strict privacy policy." : "Ổn định + Chính xác. Test tự động, quyền riêng tư rõ ràng."}
                                </p>
                            </div>
                            <div className="p-4 rounded-lg border border-border bg-card">
                                <h4 className="font-semibold mb-2 text-primary">3–6 {isEn ? "Months" : "Tháng"}</h4>
                                <p className="text-sm text-muted-foreground">
                                    {isEn ? "instrumentation + Onboarding. Explanation of sensitivity modes." : "Đo lường + Onboarding. Giải thích các chế độ nhạy cảm."}
                                </p>
                            </div>
                            <div className="p-4 rounded-lg border border-border bg-card">
                                <h4 className="font-semibold mb-2 text-primary">6–12 {isEn ? "Months" : "Tháng"}</h4>
                                <p className="text-sm text-muted-foreground">
                                    {isEn ? "Privacy-first personalization. Local-only features." : "Cá nhân hóa ưu tiên riêng tư. Tính năng thuần offline."}
                                </p>
                            </div>
                        </div>
                    </section>
                </article>
            </div>
            <Footer />
        </main>
    )
}

export default function Whitepaper() {
    return (
        <ThemeProvider>
            <LanguageProvider>
                <WhitepaperContent />
            </LanguageProvider>
        </ThemeProvider>
    )
}
