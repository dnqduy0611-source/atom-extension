"use client"

import { motion } from "framer-motion"
import { MousePointerClick, Cpu, BookMarked, Chrome } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"

const steps = [
    {
        icon: MousePointerClick,
        numberLabel: "01",
        titleEn: "Highlight",
        titleVi: "Highlight",
        descEn: "Select any text on any webpage. AmoNexus detects your selection instantly.",
        descVi: "Chọn bất kỳ đoạn text nào trên web. AmoNexus nhận diện ngay lập tức.",
        color: "from-violet-500 to-purple-500",
    },
    {
        icon: Cpu,
        numberLabel: "02",
        titleEn: "AI Analyzes",
        titleVi: "AI Phân tích",
        descEn: "AI summarizes, explains, and generates insights. Ask follow-up questions naturally.",
        descVi: "AI tóm tắt, giải thích, và tạo insights. Hỏi thêm một cách tự nhiên.",
        color: "from-primary to-emerald-400",
    },
    {
        icon: BookMarked,
        numberLabel: "03",
        titleEn: "Remember",
        titleVi: "Ghi nhớ",
        descEn: "Save to your Neural Memory. AI organizes, connects, and helps you recall when needed.",
        descVi: "Lưu vào Neural Memory. AI tổ chức, kết nối, và giúp bạn gợi nhớ khi cần.",
        color: "from-amber-500 to-orange-500",
    },
]

export function WhatsNewFlow() {
    const { t } = useLanguage()
    const { theme } = useTheme()

    return (
        <section className="py-24 px-4 bg-muted/30">
            <div className="max-w-5xl mx-auto">
                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-20"
                >
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
                        {t(
                            <>
                                Start in <span className="text-primary">60 seconds</span>
                            </>,
                            <>
                                Bắt đầu trong <span className="text-primary">60 giây</span>
                            </>,
                        )}
                    </h2>
                    <p className="text-muted-foreground max-w-xl mx-auto">
                        {t(
                            "Three simple steps to unlock your second brain.",
                            "Ba bước đơn giản để kích hoạt bộ não thứ hai.",
                        )}
                    </p>
                </motion.div>

                {/* Steps */}
                <div className="relative">
                    {/* Connecting line */}
                    <div className="hidden md:block absolute top-[60px] left-[16.5%] right-[16.5%] h-[2px]">
                        <motion.div
                            initial={{ scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className={`h-full origin-left ${theme === "dark"
                                    ? "bg-gradient-to-r from-violet-500/50 via-primary/50 to-amber-500/50"
                                    : "bg-gradient-to-r from-violet-500/30 via-primary/30 to-amber-500/30"
                                }`}
                        />
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 md:gap-12">
                        {steps.map((step, index) => (
                            <motion.div
                                key={step.titleEn}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
                                className="flex flex-col items-center text-center"
                            >
                                {/* Icon circle */}
                                <div className="relative mb-8">
                                    <div
                                        className={`w-[120px] h-[120px] rounded-full bg-gradient-to-br ${step.color} p-[2px]`}
                                    >
                                        <div
                                            className={`w-full h-full rounded-full ${theme === "dark" ? "bg-background" : "bg-background"
                                                } flex items-center justify-center`}
                                        >
                                            <step.icon className="w-10 h-10 text-foreground" />
                                        </div>
                                    </div>
                                    {/* Step number */}
                                    <span
                                        className={`absolute -top-2 -right-2 text-xs font-bold px-2.5 py-1 rounded-full bg-gradient-to-r ${step.color} text-white`}
                                    >
                                        {step.numberLabel}
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-foreground mb-3">
                                    {t(step.titleEn, step.titleVi)}
                                </h3>
                                <p className="text-muted-foreground leading-relaxed max-w-xs">
                                    {t(step.descEn, step.descVi)}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="flex flex-col items-center mt-20 gap-4"
                >
                    <a
                        href="https://chromewebstore.google.com/detail/atom-mindful-browsing/hopeblmpkfjedagoplldhddgljmikjkk"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button
                            size="lg"
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-10 py-6 text-base rounded-full gap-2 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] transition-all"
                        >
                            <Chrome className="w-5 h-5" />
                            {t("Get AmoNexus — It's Free", "Tải AmoNexus — Miễn phí")}
                        </Button>
                    </a>
                    <span className="text-xs text-muted-foreground">
                        {t(
                            "Works on Chrome, Edge, Brave, and all Chromium browsers.",
                            "Hoạt động trên Chrome, Edge, Brave, và mọi trình duyệt Chromium.",
                        )}
                    </span>
                </motion.div>
            </div>
        </section>
    )
}
