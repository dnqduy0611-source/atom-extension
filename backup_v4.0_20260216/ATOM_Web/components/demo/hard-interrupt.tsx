"use client"

import { useState, useEffect, useRef } from "react"
import { useLanguage } from "@/lib/language-context"
import { Wind, Hand, Timer, X } from "lucide-react"

type DemoMode = "breath" | "tap" | "still"

export function HardInterruptDemo() {
    const { t } = useLanguage()
    const [isActive, setIsActive] = useState(false)
    const [mode, setMode] = useState<DemoMode>("breath")

    // Tap (Hold) Mode State
    const [holdProgress, setHoldProgress] = useState(0)
    const [isHolding, setIsHolding] = useState(false)
    const holdIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // Still Mode State
    const [timeLeft, setTimeLeft] = useState(10)
    const [isStill, setIsStill] = useState(false)

    // Reset state when opening/changing modes
    useEffect(() => {
        if (!isActive) return
        setHoldProgress(0)
        setIsHolding(false)
        setTimeLeft(10)
        setIsStill(false)
    }, [isActive, mode])

    // Timer for Still Mode
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isActive && mode === "still" && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1)
            }, 1000)
        } else if (timeLeft === 0) {
            setIsStill(true)
        }
        return () => clearInterval(interval)
    }, [isActive, mode, timeLeft])

    // Hold Logic for Tap Mode
    useEffect(() => {
        if (isHolding && holdProgress < 100) {
            holdIntervalRef.current = setInterval(() => {
                setHoldProgress(prev => Math.min(prev + 2, 100))
            }, 30) // ~1.5 seconds to fill
        } else {
            if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
            if (!isHolding && holdProgress < 100 && holdProgress > 0) {
                // Degrade if released early
                const degradeInterval = setInterval(() => {
                    setHoldProgress(prev => {
                        if (prev <= 0) {
                            clearInterval(degradeInterval)
                            return 0
                        }
                        return prev - 5
                    })
                }, 20)
            }
        }
        return () => {
            if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
        }
    }, [isHolding, holdProgress])

    const startHold = () => setIsHolding(true)
    const endHold = () => setIsHolding(false)

    const renderContent = () => {
        switch (mode) {
            case "breath":
                return (
                    <div className="flex flex-col items-center">
                        <div className="w-40 h-40 rounded-full border border-emerald-500/30 bg-radial-emerald shadow-[0_0_60px_rgba(16,185,129,0.4)] flex items-center justify-center mb-8 animate-[breath_4s_ease-in-out_infinite]">
                            <span className="text-emerald-100 text-sm font-medium tracking-widest uppercase">{t("Breathe", "Hít thở")}</span>
                        </div>
                        <p className="text-gray-300 font-light tracking-wide text-lg text-center animate-pulse">
                            {t("Inhale... Exhale...", "Hít vào... Thở ra...")}
                        </p>
                    </div>
                )
            case "tap":
                return (
                    <div className="flex flex-col items-center select-none">
                        {holdProgress < 100 ? (
                            <>
                                <button
                                    onMouseDown={startHold}
                                    onMouseUp={endHold}
                                    onMouseLeave={endHold}
                                    onTouchStart={startHold}
                                    onTouchEnd={endHold}
                                    className="relative w-32 h-32 rounded-full border border-white/20 bg-white/5 backdrop-blur-md shadow-2xl flex items-center justify-center mb-8 active:scale-95 transition-all outline-none"
                                    style={{
                                        boxShadow: `0 0 ${holdProgress * 0.5}px rgba(16, 185, 129, 0.5)`
                                    }}
                                >
                                    {/* Progress Ring SVG */}
                                    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                                        <circle
                                            cx="64" cy="64" r="62"
                                            stroke="rgba(255,255,255,0.1)"
                                            strokeWidth="4"
                                            fill="transparent"
                                        />
                                        <circle
                                            cx="64" cy="64" r="62"
                                            stroke="#10B981"
                                            strokeWidth="4"
                                            fill="transparent"
                                            strokeDasharray={390}
                                            strokeDashoffset={390 - (390 * holdProgress) / 100}
                                            strokeLinecap="round"
                                            className="transition-all duration-75 ease-linear"
                                        />
                                    </svg>

                                    <Hand className={`w-10 h-10 transition-colors ${isHolding ? 'text-emerald-400' : 'text-white/70'}`} />
                                </button>
                                <p className="text-gray-300 font-light tracking-wide text-lg text-center">
                                    {t("Press and Hold to unlock", "Nhấn và Giữ để mở khóa")}
                                </p>
                            </>
                        ) : (
                            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
                                    <Hand className="w-10 h-10 text-emerald-400" />
                                </div>
                                <p className="text-emerald-300 font-medium text-lg">
                                    {t("Unlocked!", "Đã mở khóa!")}
                                </p>
                            </div>
                        )}
                    </div>
                )
            case "still":
                return (
                    <div className="flex flex-col items-center">
                        {!isStill ? (
                            <>
                                <div className="relative w-40 h-40 flex items-center justify-center mb-8">
                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                        <circle cx="80" cy="80" r="70" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="transparent" />
                                        <circle
                                            cx="80" cy="80" r="70"
                                            stroke="#10B981"
                                            strokeWidth="4"
                                            fill="transparent"
                                            strokeDasharray={440}
                                            strokeDashoffset={440 - (440 * timeLeft) / 10}
                                            className="transition-all duration-1000 ease-linear"
                                        />
                                    </svg>
                                    <span className="text-5xl font-light text-white tabular-nums">{timeLeft}</span>
                                </div>
                                <p className="text-gray-300 font-light tracking-wide text-lg text-center">
                                    {t("Stay still...", "Hãy giữ yên lặng...")}
                                </p>
                            </>
                        ) : (
                            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
                                    <Timer className="w-10 h-10 text-emerald-400" />
                                </div>
                                <p className="text-emerald-300 font-medium text-lg">
                                    {t("Focus regained!", "Đã lấy lại sự tập trung!")}
                                </p>
                            </div>
                        )}
                    </div>
                )
        }
    }

    return (
        <div className="relative h-[400px] w-full bg-background/50 border border-border rounded-xl flex flex-col items-center justify-center overflow-hidden group p-6">

            {!isActive ? (
                <div className="flex flex-col items-center gap-6">
                    <h3 className="text-xl font-bold">{t("Hard Interrupt Modes", "Các chế độ Can thiệp Sâu")}</h3>
                    <div className="flex gap-4">
                        <button
                            onClick={() => { setMode('breath'); setIsActive(true) }}
                            className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all w-28"
                        >
                            <Wind className="w-6 h-6 text-emerald-500" />
                            <span className="text-sm font-medium">{t("Breathe", "Hít thở")}</span>
                        </button>
                        <button
                            onClick={() => { setMode('tap'); setIsActive(true) }}
                            className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all w-28"
                        >
                            <Hand className="w-6 h-6 text-blue-500" />
                            <span className="text-sm font-medium">{t("Tap", "Chạm")}</span>
                        </button>
                        <button
                            onClick={() => { setMode('still'); setIsActive(true) }}
                            className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all w-28"
                        >
                            <Timer className="w-6 h-6 text-amber-500" />
                            <span className="text-sm font-medium">{t("Stillness", "Tĩnh lặng")}</span>
                        </button>
                    </div>
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                        {t("Click a mode to test the overlay experience.", "Chọn một chế độ để thử nghiệm giao diện lớp phủ.")}
                    </p>
                </div>
            ) : (
                /* Overlay */
                <div
                    className="absolute inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center transition-all duration-700 z-10 animate-in fade-in"
                >
                    <button
                        onClick={() => setIsActive(false)}
                        className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
                        title={t("Close Demo", "Đóng Demo") as string}
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {renderContent()}

                    {(mode === "breath" || (mode === "tap" && holdProgress >= 100) || (mode === "still" && isStill)) && (
                        <button
                            onClick={() => setIsActive(false)}
                            className="mt-12 text-sm text-white/40 hover:text-white transition-colors border-b border-transparent hover:border-white/40 pb-0.5"
                        >
                            {t("Dismiss Intervention", "Đóng lớp phủ")}
                        </button>
                    )}
                </div>
            )}

            <style jsx>{`
        .bg-radial-emerald {
            background: radial-gradient(circle, rgba(16,185,129,1) 0%, transparent 70%);
        }
        @keyframes breath {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.2); opacity: 1; filter: blur(0px); }
        }
      `}</style>
        </div>
    )
}
