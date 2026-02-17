"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"
import type { LucideIcon } from "lucide-react"

interface WorkflowStep {
    emoji: string
    en: string
    vi: string
}

export interface FeatureWithWorkflow {
    icon: LucideIcon
    titleEn: string
    titleVi: string
    descEn: string
    descVi: string
    gradient: string
    tag: string
    stepsEn: string[]
    stepsVi: string[]
    stepEmojis: string[]
    tipEn?: string
    tipVi?: string
}

interface FeatureWorkflowModalProps {
    feature: FeatureWithWorkflow | null
    isOpen: boolean
    onClose: () => void
}

// Map gradient classes to actual color values for the modal accent
const gradientToColor: Record<string, { from: string; to: string; text: string }> = {
    "from-violet-500/20 to-purple-500/10": { from: "rgba(139,92,246,0.15)", to: "rgba(168,85,247,0.08)", text: "#8B5CF6" },
    "from-amber-500/20 to-orange-500/10": { from: "rgba(245,158,11,0.15)", to: "rgba(249,115,22,0.08)", text: "#F59E0B" },
    "from-cyan-500/20 to-blue-500/10": { from: "rgba(6,182,212,0.15)", to: "rgba(59,130,246,0.08)", text: "#06B6D4" },
    "from-pink-500/20 to-rose-500/10": { from: "rgba(236,72,153,0.15)", to: "rgba(244,63,94,0.08)", text: "#EC4899" },
    "from-emerald-500/20 to-teal-500/10": { from: "rgba(16,185,129,0.15)", to: "rgba(20,184,166,0.08)", text: "#10B981" },
    "from-blue-500/20 to-indigo-500/10": { from: "rgba(59,130,246,0.15)", to: "rgba(99,102,241,0.08)", text: "#3B82F6" },
    "from-sky-500/20 to-blue-500/10": { from: "rgba(14,165,233,0.15)", to: "rgba(59,130,246,0.08)", text: "#0EA5E9" },
    "from-slate-500/20 to-gray-500/10": { from: "rgba(100,116,139,0.15)", to: "rgba(107,114,128,0.08)", text: "#64748B" },
}

export function FeatureWorkflowModal({ feature, isOpen, onClose }: FeatureWorkflowModalProps) {
    const { t } = useLanguage()
    const { theme } = useTheme()

    if (!feature) return null

    const colors = gradientToColor[feature.gradient] || { from: "rgba(16,185,129,0.15)", to: "rgba(20,184,166,0.08)", text: "#10B981" }
    const steps = t(feature.stepsEn, feature.stepsVi) as unknown as string[]
    const tip = feature.tipEn ? t(feature.tipEn, feature.tipVi || "") : null
    const Icon = feature.icon

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Modal */}
                    <motion.div
                        className={`relative w-full max-w-lg rounded-2xl border ${theme === "dark"
                            ? "bg-[#0a0a0a] border-white/10"
                            : "bg-white border-black/10"
                            } shadow-2xl overflow-hidden`}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Gradient header accent */}
                        <div
                            className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
                            style={{
                                background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                            }}
                        />

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className={`absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${theme === "dark"
                                ? "bg-white/10 hover:bg-white/20 text-white/60 hover:text-white"
                                : "bg-black/5 hover:bg-black/10 text-black/40 hover:text-black/70"
                                }`}
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Content */}
                        <div className="relative p-6 pt-8">
                            {/* Header */}
                            <div className="flex items-center gap-4 mb-6">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: colors.from }}
                                >
                                    <Icon className="w-6 h-6" style={{ color: colors.text }} />
                                </div>
                                <div>
                                    <span
                                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${theme === "dark"
                                            ? "border-white/10 text-white/40"
                                            : "border-black/10 text-black/40"
                                            }`}
                                    >
                                        {feature.tag}
                                    </span>
                                    <h3 className="text-xl font-bold text-foreground mt-1">
                                        {t(feature.titleEn, feature.titleVi)}
                                    </h3>
                                </div>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                                {t(feature.descEn, feature.descVi)}
                            </p>

                            {/* Workflow Steps */}
                            <div className="space-y-3 mb-6">
                                <h4
                                    className="text-xs font-semibold uppercase tracking-wider"
                                    style={{ color: colors.text }}
                                >
                                    {t("How it works", "Cách hoạt động")}
                                </h4>
                                {(steps as string[]).map((step: string, i: number) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + i * 0.08 }}
                                        className={`flex items-start gap-3 p-3 rounded-xl ${theme === "dark"
                                            ? "bg-white/[0.03]"
                                            : "bg-black/[0.02]"
                                            }`}
                                    >
                                        <span className="text-lg shrink-0 mt-0.5">
                                            {feature.stepEmojis[i] || "▸"}
                                        </span>
                                        <div className="flex items-start gap-2">
                                            <span
                                                className="text-xs font-bold shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                                                style={{ background: colors.from, color: colors.text }}
                                            >
                                                {i + 1}
                                            </span>
                                            <p className="text-sm text-foreground leading-relaxed">{step}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Pro Tip */}
                            {tip && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className={`flex items-start gap-2 p-3 rounded-xl border ${theme === "dark"
                                        ? "bg-amber-500/5 border-amber-500/10"
                                        : "bg-amber-50 border-amber-200/50"
                                        }`}
                                >
                                    <span className="text-sm shrink-0">💡</span>
                                    <p className={`text-xs leading-relaxed ${theme === "dark" ? "text-amber-200/70" : "text-amber-800/70"
                                        }`}>
                                        <span className="font-semibold">{t("Pro Tip: ", "Mẹo: ")}</span>
                                        {tip as string}
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
