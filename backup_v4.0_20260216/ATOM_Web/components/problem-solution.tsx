"use client"

import { motion } from "framer-motion"
import { Ban, Compass, X, Check } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"

export function ProblemSolution() {
  const { t } = useLanguage()
  const { theme } = useTheme()

  const oldBlockerItems = [
    { en: "Full-screen blocks that cause anxiety", vi: "Màn hình chặn toàn phần gây lo âu" },
    { en: "Static rules that don't adapt", vi: "Quy tắc cứng nhắc không linh hoạt" },
    { en: "Shame-based messaging", vi: "Thông điệp gây xấu hổ" },
    { en: "Data sent to external servers", vi: "Dữ liệu gửi đến máy chủ bên ngoài" },
  ]

  const atomItems = [
    { en: "Gentle micro-interventions", vi: "Can thiệp nhẹ nhàng dạng vi mô" },
    { en: "Adaptive thresholds based on your state", vi: "Ngưỡng linh hoạt dựa trên trạng thái của bạn" },
    { en: "Empathetic, supportive guidance", vi: "Hướng dẫn đồng cảm, hỗ trợ" },
    { en: "100% local processing, privacy-first", vi: "Xử lý 100% cục bộ, ưu tiên riêng tư" },
  ]

  return (
    <section className="py-24 px-4">
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
                A <span className="text-primary">completely different</span> approach
              </>,
              <>
                Một cách tiếp cận <span className="text-primary">hoàn toàn khác</span>
              </>,
            )}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t(
              "Traditional blockers treat you like a criminal. AmoNexus trusts you.",
              "Các công cụ chặn truyền thống đối xử với bạn như tội phạm. AmoNexus tin tưởng bạn.",
            )}
          </p>
        </motion.div>

        {/* Comparison cards - adjusted opacity values for light mode */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Old Blockers */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative group"
          >
            <div
              className={`absolute inset-0 ${theme === "dark" ? "bg-red-500/5" : "bg-red-500/10"} rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
            />
            <div
              className={`relative p-8 rounded-2xl border ${theme === "dark" ? "border-red-500/20 bg-red-500/5" : "border-red-500/30 bg-red-500/5"} backdrop-blur-sm`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className={`w-12 h-12 rounded-xl ${theme === "dark" ? "bg-red-500/20" : "bg-red-500/15"} flex items-center justify-center`}
                >
                  <Ban className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{t("Old Blockers", "Công cụ chặn Cũ")}</h3>
                  <p className="text-sm text-red-500">{t("Jail Approach", "Cách tiếp cận Nhà tù")}</p>
                </div>
              </div>

              <ul className="space-y-4">
                {oldBlockerItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-full ${theme === "dark" ? "bg-red-500/20" : "bg-red-500/15"} flex items-center justify-center flex-shrink-0 mt-0.5`}
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </div>
                    <span className="text-muted-foreground">{t(item.en, item.vi)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* ATOM */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="relative group"
          >
            <div
              className={`absolute inset-0 ${theme === "dark" ? "bg-primary/10" : "bg-primary/15"} rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
            />
            <div
              className={`relative p-8 rounded-2xl border ${theme === "dark" ? "border-primary/30 bg-primary/5" : "border-primary/40 bg-primary/5"} backdrop-blur-sm hover:border-primary/50 transition-colors duration-300`}
            >
              <div className="flex items-center gap-3 mb-6">
                <div
                  className={`w-12 h-12 rounded-xl ${theme === "dark" ? "bg-primary/20" : "bg-primary/15"} flex items-center justify-center`}
                >
                  <Compass className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">AmoNexus</h3>
                  <p className="text-sm text-primary">{t("Compass Approach", "Cách tiếp cận La bàn")}</p>
                </div>
              </div>

              <ul className="space-y-4">
                {atomItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-full ${theme === "dark" ? "bg-primary/20" : "bg-primary/15"} flex items-center justify-center flex-shrink-0 mt-0.5`}
                    >
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-muted-foreground">{t(item.en, item.vi)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
