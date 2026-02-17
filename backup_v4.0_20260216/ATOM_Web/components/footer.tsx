"use client"

import { motion } from "framer-motion"
import { Github, Twitter } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/lib/language-context"
import { useTheme } from "@/lib/theme-context"

export function Footer() {
  const { t } = useLanguage()
  const { theme } = useTheme()

  return (
    <footer className="py-12 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row items-center justify-between gap-6"
        >
          {/* Logo */}
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">A</span>
            </div>
            <span className="text-foreground font-semibold">AmoNexus</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
              {t("Privacy", "Riêng tư")}
            </Link>
            <Link href="#" className="hover:text-foreground transition-colors">
              {t("Terms", "Điều khoản")}
            </Link>
            <Link href="/whitepaper" className="hover:text-foreground transition-colors">
              {t("Whitepaper", "Sách trắng")}
            </Link>
            <Link href="/showcase" className="hover:text-foreground transition-colors">
              {t("Gallery", "Thư viện Demo")}
            </Link>
            <Link href="/whats-new" className="hover:text-primary transition-colors font-medium">
              {t("What's New", "Có gì mới")}
            </Link>
            <a href="https://lofi.amonexus.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors font-medium">
              {t("Amo Lofi", "Amo Lofi")}
            </a>
            <Link href="#" className="hover:text-foreground transition-colors">
              {t("Support", "Hỗ trợ")}
            </Link>
          </div>

          {/* Social - adjusted hover colors for theme */}
          <div className="flex items-center gap-4">
            <a
              href="#"
              className={`w-10 h-10 rounded-full border border-border ${theme === "dark" ? "bg-secondary/50" : "bg-secondary"} flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 transition-colors`}
            >
              <Github className="w-5 h-5 text-muted-foreground" />
            </a>
            <a
              href="#"
              className={`w-10 h-10 rounded-full border border-border ${theme === "dark" ? "bg-secondary/50" : "bg-secondary"} flex items-center justify-center hover:border-primary/50 hover:bg-primary/10 transition-colors`}
            >
              <Twitter className="w-5 h-5 text-muted-foreground" />
            </a>
          </div>
        </motion.div>

        {/* Copyright */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mt-8 pt-8 border-t border-border"
        >
          <p className="text-sm text-muted-foreground">
            {t(
              "© 2026 ATOM. Built with care for mindful digital wellness.",
              "© 2026 ATOM. Được xây dựng với sự quan tâm cho sức khỏe kỹ thuật số chánh niệm.",
            )}
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
