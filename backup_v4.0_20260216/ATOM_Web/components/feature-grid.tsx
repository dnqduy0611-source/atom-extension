"use client"

import { motion } from "framer-motion"
import { Activity, Heart, Shield, Zap } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"

const features = [
  {
    icon: Zap,
    titleEn: "AI Commanding",
    titleVi: "Điều khiển bằng AI",
    descEn: "Control your browser with natural language. Say 'open new tab', 'search for...', or 'close this' and AmoNexus executes instantly.",
    descVi: "Điều khiển trình duyệt bằng ngôn ngữ tự nhiên. Nói 'mở tab mới', 'tìm kiếm...', hoặc 'đóng tab này' và AmoNexus thực thi ngay.",
    gradient: "from-violet-500/20 to-purple-500/10",
  },
  {
    icon: Activity,
    titleEn: "Second Brain",
    titleVi: "Bộ nhớ Thứ hai",
    descEn: "Save insights automatically. AI categorizes your notes by topic, giving you a searchable knowledge base that grows with you.",
    descVi: "Lưu insight tự động. AI phân loại ghi chú theo chủ đề, tạo nên kho tri thức có thể tìm kiếm và phát triển cùng bạn.",
    gradient: "from-primary/20 to-primary/10",
  },
  {
    icon: Heart,
    titleEn: "Gentle Intervention",
    titleVi: "Can thiệp Nhẹ nhàng",
    descEn: "Instead of rigid blocking, AmoNexus uses a 'least intrusive' ladder: Presence signals, Micro-closure prompts, and Hard Interrupts only when truly needed.",
    descVi: "Thay vì chặn cứng nhắc, AmoNexus dùng chiến thuật 'leo thang tối thiểu': Tín hiệu hiện diện, Lời nhắc nhẹ, và chỉ Can thiệp sâu khi thực sự cần.",
    gradient: "from-pink-500/20 to-rose-500/10",
  },
  {
    icon: Shield,
    titleEn: "Multi-Model Intelligence",
    titleVi: "Trí tuệ Đa mô hình",
    descEn: "Powered by Gemini with OpenRouter fallback. Smart model switching ensures you always have AI support, even during rate limits.",
    descVi: "Sử dụng Gemini với OpenRouter dự phòng. Chuyển đổi mô hình thông minh đảm bảo bạn luôn có hỗ trợ AI, ngay cả khi bị giới hạn.",
    gradient: "from-blue-500/20 to-cyan-500/10",
  },
]

export function FeatureGrid() {
  const { t } = useLanguage()
  const { theme } = useTheme()

  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
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
                Built with <span className="text-primary">understanding</span>
              </>,
              <>
                Được xây dựng với <span className="text-primary">sự thấu hiểu</span>
              </>,
            )}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t(
              "Every feature is designed to support you, not control you.",
              "Mọi tính năng đều được thiết kế để hỗ trợ, không phải kiểm soát bạn.",
            )}
          </p>
        </motion.div>

        {/* Bento Grid - adjusted glow effects for theme */}
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.titleEn}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative"
            >
              {/* Hover glow effect */}
              <div
                className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/50 group-hover:via-primary/30 group-hover:to-primary/50 opacity-0 group-hover:opacity-100 transition-all duration-500 blur-sm`}
              />

              {/* Card */}
              <div
                className={`relative h-full p-6 md:p-8 rounded-2xl border border-border ${theme === "dark" ? "bg-card" : "bg-card"} backdrop-blur-sm group-hover:border-primary/30 transition-colors duration-300`}
              >
                {/* Background gradient */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />

                {/* Content */}
                <div className="relative">
                  <div
                    className={`w-12 h-12 rounded-xl ${theme === "dark" ? "bg-secondary" : "bg-secondary"} flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors duration-300`}
                  >
                    <feature.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{t(feature.titleEn, feature.titleVi)}</h3>
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
