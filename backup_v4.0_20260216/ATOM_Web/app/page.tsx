"use client"

import { LanguageProvider } from "@/lib/language-context"
import { ThemeProvider } from "@/lib/theme-context"
import { AuthProvider } from "@/lib/auth-context"
import { HeroSection } from "@/components/hero-section"
import { ProblemSolution } from "@/components/problem-solution"
import { FeatureGrid } from "@/components/feature-grid"
import { IntelligenceSection } from "@/components/intelligence-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <main className="min-h-screen overflow-hidden">
            <HeroSection />
            <ProblemSolution />
            <FeatureGrid />
            <IntelligenceSection />
            <Footer />
          </main>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
