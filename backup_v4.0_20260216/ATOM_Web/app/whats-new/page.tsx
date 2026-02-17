"use client"

import { LanguageProvider } from "@/lib/language-context"
import { ThemeProvider } from "@/lib/theme-context"
import { AuthProvider } from "@/lib/auth-context"
import { WhatsNewHero } from "@/components/whats-new-hero"
import { WhatsNewFeatures } from "@/components/whats-new-features"
import { WhatsNewFlow } from "@/components/whats-new-flow"
import { Footer } from "@/components/footer"

export default function WhatsNewPage() {
    return (
        <ThemeProvider>
            <LanguageProvider>
                <AuthProvider>
                    <main className="min-h-screen overflow-hidden">
                        <WhatsNewHero />
                        <WhatsNewFeatures />
                        <WhatsNewFlow />
                        <Footer />
                    </main>
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    )
}
