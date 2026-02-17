"use client"

import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { AuthButton } from "@/components/auth-button"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"

export function WhatsNewHero() {
    const { t } = useLanguage()
    const { theme } = useTheme()

    return (
        <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 py-20">
            {/* Background gradient */}
            <div
                className={`absolute inset-0 ${theme === "dark"
                    ? "bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12)_0%,_transparent_60%)]"
                    : "bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15)_0%,_transparent_60%)]"
                    }`}
            />

            {/* Grid pattern */}
            <div
                className={`absolute inset-0 ${theme === "dark" ? "opacity-[0.02]" : "opacity-[0.05]"}`}
                style={{
                    backgroundImage: `linear-gradient(${theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} 1px, transparent 1px),
                           linear-gradient(90deg, ${theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} 1px, transparent 1px)`,
                    backgroundSize: "50px 50px",
                }}
            />

            {/* Nav */}
            <motion.nav
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 md:px-12 py-6"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground font-bold text-sm">A</span>
                    </div>
                    <span className="text-foreground font-semibold text-lg">AmoNexus</span>
                </a>
                <div className="flex items-center gap-4">
                    <ThemeSwitcher />
                    <LanguageSwitcher />
                    <AuthButton />
                </div>
            </motion.nav>

            {/* Main content */}
            <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
                {/* Version badge */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="mb-8"
                >
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm">
                        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                        <span className="text-sm font-semibold text-primary">
                            {t("Version 4.0 — What's New", "Phiên bản 4.0 — Có gì mới")}
                        </span>
                    </div>
                </motion.div>

                {/* Headline */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-balance"
                >
                    <span className="text-foreground">
                        {t("Your Neural ", "Trung tâm ")}
                    </span>
                    <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                        {t("Second Brain.", "Trí tuệ Thứ hai.")}
                    </span>
                </motion.h1>

                {/* Subheadline */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 text-pretty"
                >
                    {t(
                        "AmoNexus helps you read smarter, remember deeper, and focus longer — all powered by AI that respects your attention.",
                        "AmoNexus giúp bạn đọc thông minh hơn, nhớ sâu hơn, và tập trung lâu hơn — tất cả được hỗ trợ bởi AI tôn trọng sự chú ý của bạn.",
                    )}
                </motion.p>

                {/* Scroll hint */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    className="flex flex-col items-center gap-2"
                >
                    <span className="text-xs text-muted-foreground uppercase tracking-widest">
                        {t("Scroll to explore", "Cuộn để khám phá")}
                    </span>
                    <motion.div
                        animate={{ y: [0, 6, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="w-5 h-8 rounded-full border-2 border-border flex justify-center pt-1.5"
                    >
                        <div className="w-1 h-1 rounded-full bg-primary" />
                    </motion.div>
                </motion.div>
            </div>
        </section>
    )
}
