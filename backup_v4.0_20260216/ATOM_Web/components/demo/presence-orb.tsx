"use client"

import { useEffect, useState } from "react"

export function PresenceOrb() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        // Auto-show animation loop
        const interval = setInterval(() => {
            setVisible((v) => !v)
        }, 3000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="relative h-64 w-full bg-background/50 border border-border rounded-xl flex items-center justify-center overflow-hidden">
            <p className="text-muted-foreground text-sm">Orb pulses in corner</p>
            <div
                className={`absolute bottom-6 right-6 w-8 h-8 rounded-full border border-primary bg-background shadow-[0_0_10px_var(--primary)] transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] ${visible ? 'opacity-80 scale-100' : 'opacity-0 scale-50'}`}
            >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/5 h-2/5 bg-primary rounded-full blur-[2px]" />
            </div>
        </div>
    )
}
