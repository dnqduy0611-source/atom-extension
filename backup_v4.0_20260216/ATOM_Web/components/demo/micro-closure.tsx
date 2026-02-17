"use client"

import { useState } from "react"
import { useLanguage } from "@/lib/language-context"

export function MicroClosurePill() {
    const { t } = useLanguage()
    const [isVisible, setIsVisible] = useState(true)

    const handleAction = () => {
        setIsVisible(false)
        setTimeout(() => setIsVisible(true), 2000)
    }

    return (
        <div className="relative h-64 w-full bg-background/50 border border-border rounded-xl flex items-center justify-center overflow-hidden">
            {!isVisible && <p className="text-muted-foreground text-sm animate-pulse">Reappearing...</p>}
            <div
                className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-full shadow-2xl transition-all duration-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'}`}
            >
                <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_12px_#FFD700] animate-pulse" />
                <span className="text-gray-100 text-sm font-medium whitespace-nowrap mr-2">
                    {t("Time for a break?", "Đã đến lúc nghỉ ngơi?")}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={handleAction}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-transparent hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 hover:border-white/40 transition-all"
                    >
                        {t("Snooze", "Để sau")}
                    </button>
                    <button
                        onClick={handleAction}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white hover:bg-gray-200 text-black shadow-sm transition-all"
                    >
                        {t("Stop", "Dừng lại")}
                    </button>
                </div>
            </div>
        </div>
    )
}
