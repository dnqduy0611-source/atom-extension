"use client"

import { useLanguage } from "@/lib/language-context"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === "en" ? "vi" : "en")}
      className="gap-2 text-muted-foreground hover:text-foreground hover:bg-white/10"
    >
      <Globe className="w-4 h-4" />
      <span className="font-medium">{language === "en" ? "EN" : "VI"}</span>
    </Button>
  )
}
