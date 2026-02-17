"use client"

/**
 * AuthButton — Login / User avatar button for the landing site nav.
 *
 * Logged out: Shows "Đăng nhập" / "Sign In" button (bilingual via t()).
 * Logged in:  Shows avatar + first name with a dropdown for sign-out.
 */

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { LogIn, LogOut, ChevronDown } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"

export function AuthButton() {
    const { user, isLoading, signIn, signOut } = useAuth()
    const { t } = useLanguage()
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu on outside click
    useEffect(() => {
        if (!menuOpen) return
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [menuOpen])

    if (isLoading) {
        return (
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        )
    }

    // ── Logged In ──
    if (user) {
        const avatarUrl = user.user_metadata?.avatar_url
        const displayName =
            user.user_metadata?.full_name?.split(" ")[0] ||
            user.email?.split("@")[0] ||
            "User"

        return (
            <div ref={menuRef} className="relative">
                <button
                    onClick={() => setMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer
            hover:bg-secondary/80 border border-transparent hover:border-border"
                >
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="rounded-full ring-2 ring-primary/30"
                        />
                    ) : (
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                            {displayName[0]?.toUpperCase()}
                        </div>
                    )}
                    <span className="text-sm text-muted-foreground hidden sm:block max-w-[100px] truncate">
                        {displayName}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                    {menuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden z-50
                bg-popover border border-border shadow-xl"
                        >
                            {/* User info */}
                            <div className="px-4 py-3 border-b border-border">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {user.user_metadata?.full_name || displayName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {user.email}
                                </p>
                            </div>

                            {/* Sign out */}
                            <button
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground
                  hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                                onClick={async () => {
                                    setMenuOpen(false)
                                    await signOut()
                                }}
                            >
                                <LogOut className="w-4 h-4" />
                                {t("Sign Out", "Đăng xuất")}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        )
    }

    // ── Logged Out ──
    return (
        <button
            onClick={signIn}
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 cursor-pointer
        bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40
        text-primary font-medium text-sm hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
        >
            <LogIn className="w-4 h-4" />
            {t("Sign In", "Đăng nhập")}
        </button>
    )
}
