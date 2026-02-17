"use client"

import { motion } from "framer-motion"
import { Scan, TrendingUp, Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"

const features = [
    {
        icon: Scan,
        titleEn: "Context Awareness",
        titleVi: "Nhận thức Ngữ cảnh",
        descEn: "AmoNexus understands what you're doing: reading, scrolling, or working. It adapts its behavior based on your activity patterns.",
        descVi: "AmoNexus hiểu bạn đang làm gì: đọc, cuộn trang, hay làm việc. Nó điều chỉnh hành vi dựa trên mẫu hoạt động của bạn.",
        gradient: "from-violet-500/20 to-purple-500/10",
    },
    {
        icon: TrendingUp,
        titleEn: "Learning Memory",
        titleVi: "Bộ nhớ Học tập",
        descEn: "Your saved insights are categorized by AI. Over time, AmoNexus learns your interests and can surface relevant memories when needed.",
        descVi: "Insight bạn lưu được AI phân loại. Theo thời gian, AmoNexus học được sở thích và có thể đưa ra ký ức liên quan khi cần.",
        gradient: "from-red-500/20 to-orange-500/10",
    },
    {
        icon: Sparkles,
        titleEn: "Mood-Aware Guidance",
        titleVi: "Hướng dẫn theo Tâm trạng",
        descEn: "Integrated AI analyzes your journal and browsing patterns to offer personalized advice that matches your current emotional state.",
        descVi: "AI tích hợp phân tích nhật ký và mẫu duyệt web để đưa ra lời khuyên cá nhân hóa phù hợp với trạng thái cảm xúc hiện tại.",
        gradient: "from-emerald-500/20 to-teal-500/10",
    },
]

export function IntelligenceSection() {
    const { t } = useLanguage()
    const { theme } = useTheme()

    return (
        <section className="py-24 px-4 bg-muted/30">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                        {t("The AmoNexus Brain", "Bộ não AmoNexus")}
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                        {t(
                            "An AI that learns, adapts, and grows with you.",
                            "Một AI học hỏi, thích nghi, và phát triển cùng bạn."
                        )}
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-6 md:gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.titleEn}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="relative group h-full"
                        >
                            {/* Card */}
                            <div
                                className={`relative h-full p-6 rounded-2xl border border-border ${theme === "dark" ? "bg-card" : "bg-card"} overflow-hidden hover:shadow-lg transition-shadow duration-300`}
                            >
                                {/* Background gradient */}
                                <div
                                    className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-50 group-hover:opacity-100 transition-opacity duration-500`}
                                />

                                {/* Content */}
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <div
                                        className={`w-14 h-14 rounded-full ${theme === "dark" ? "bg-background/80" : "bg-background/80"} backdrop-blur-sm flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300`}
                                    >
                                        <feature.icon className="w-7 h-7 text-foreground" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 leading-tight">{t(feature.titleEn, feature.titleVi)}</h3>
                                    <p className="text-muted-foreground leading-relaxed">{t(feature.descEn, feature.descVi)}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
