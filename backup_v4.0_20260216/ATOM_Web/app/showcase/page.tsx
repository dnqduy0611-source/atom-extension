"use client"

import { LanguageProvider, useLanguage } from "@/lib/language-context"
import { ThemeProvider } from "@/lib/theme-context"
import { AuthProvider } from "@/lib/auth-context"
import { Footer } from "@/components/footer"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { PresenceOrb } from "@/components/demo/presence-orb"
import { MicroClosurePill } from "@/components/demo/micro-closure"
import { HardInterruptDemo } from "@/components/demo/hard-interrupt"

function ShowcaseContent() {
    const { language } = useLanguage()
    const isEn = language === "en"

    return (
        <main className="min-h-screen bg-background text-foreground selection:bg-primary/20">
            <div className="container mx-auto px-4 py-12 max-w-5xl">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    {isEn ? "Back to Home" : "Về Trang Chủ"}
                </Link>

                <div className="mb-12 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
                        {isEn ? "Intervention Gallery" : "Thư viện Can thiệp"}
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        {isEn
                            ? "See how AmoNexus gently guides your attention without being intrusive. Live interactive demos."
                            : "Xem cách AmoNexus nhẹ nhàng điều hướng sự chú ý của bạn mà không gây khó chịu. Demo tương tác trực tiếp."}
                    </p>
                </div>

                <div className="grid gap-12">
                    {/* 1. Presence Signal */}
                    <section className="grid md:grid-cols-2 gap-8 items-center">
                        <div className="order-2 md:order-1">
                            <h2 className="text-2xl font-bold mb-3">{isEn ? "1. Presence Signal" : "1. Tín hiệu Hiện diện"}</h2>
                            <p className="text-muted-foreground mb-4 leading-relaxed">
                                {isEn
                                    ? "A subtle orb pulses in the corner of your screen when you begin to drift. It's the softest nudging to remind you of your intention."
                                    : "Một quả cầu nhỏ (Orb) nhấp nháy ở góc màn hình khi bạn bắt đầu xao nhãng. Đây là lời nhắc nhẹ nhàng nhất về ý định ban đầu của bạn."}
                            </p>
                            <div className="flex gap-2 text-sm text-primary bg-primary/5 p-3 rounded-lg border border-primary/20">
                                <span className="font-semibold">Logic:</span>
                                {isEn ? "Appears after 5 mins of scroll." : "Xuất hiện sau 5 phút lướt."}
                            </div>
                        </div>
                        <div className="order-1 md:order-2">
                            <PresenceOrb />
                        </div>
                    </section>

                    <hr className="border-border/50" />

                    {/* 2. Micro Closure */}
                    <section className="grid md:grid-cols-2 gap-8 items-center">
                        <div>
                            <MicroClosurePill />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold mb-3">{isEn ? "2. Micro-Closure" : "2. Lời nhắc Vi mô"}</h2>
                            <p className="text-muted-foreground mb-4 leading-relaxed">
                                {isEn
                                    ? "If the orb is ignored, a small pill appears asking you to make a choice. No blocking, just a gentle question."
                                    : "Nếu Orb bị phớt lờ, một thanh nhắc nhỏ sẽ hiện ra yêu cầu bạn lựa chọn. Không chặn, chỉ là một câu hỏi nhẹ nhàng."}
                            </p>
                            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                                <li>{isEn ? "Finish: Close tab and log success." : "Dừng: Đóng tab và ghi nhận thành công."}</li>
                                <li>{isEn ? "Snooze: Delay next prompt." : "Để sau: Hoãn lời nhắc tiếp theo."}</li>
                                <li>{isEn ? "Scroll: Auto-dismiss (implicit ignore)." : "Cuộn tiếp: Tự ẩn (tự hiểu là lờ đi)."}</li>
                            </ul>
                        </div>
                    </section>

                    <hr className="border-border/50" />

                    {/* 3. Hard Interrupt */}
                    <section className="grid md:grid-cols-2 gap-8 items-center">
                        <div className="order-2 md:order-1">
                            <h2 className="text-2xl font-bold mb-3">{isEn ? "3. Hard Interrupt" : "3. Can thiệp Sâu"}</h2>
                            <p className="text-muted-foreground mb-4 leading-relaxed">
                                {isEn
                                    ? "Activated only when you are stuck in a doomscroll loop (High Resistance). Forces a deep breath to break the dopamine cycle."
                                    : "Chỉ kích hoạt khi bạn bị kẹt trong vòng lặp vô thức (Kháng cự cao). Buộc bạn phải hít thở sâu để phá vỡ chu kỳ dopamine."}
                            </p>
                            <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-sm md:text-base">
                                <strong className="text-red-500 block mb-1">{isEn ? "Why?" : "Tại sao?"}</strong>
                                {isEn ? "Sometimes we need a full stop to regain control." : "Đôi khi ta cần một điểm dừng hoàn toàn để lấy lại quyền kiểm soát."}
                            </div>
                        </div>
                        <div className="order-1 md:order-2">
                            <HardInterruptDemo />
                        </div>
                    </section>
                </div>

            </div>
            <Footer />
        </main>
    )
}

export default function Showcase() {
    return (
        <ThemeProvider>
            <LanguageProvider>
                <AuthProvider>
                    <ShowcaseContent />
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    )
}
