"use client"

import { LanguageProvider, useLanguage } from "@/lib/language-context"
import { ThemeProvider } from "@/lib/theme-context"
import { Footer } from "@/components/footer"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

function PrivacyPolicyContent() {
    const { language } = useLanguage()
    const isEn = language === "en"

    return (
        <main className="min-h-screen bg-background text-foreground selection:bg-primary/20">
            <div className="container mx-auto px-4 py-12 max-w-4xl">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    {isEn ? "Back to Home" : "Về Trang Chủ"}
                </Link>

                <article className="prose prose-zinc dark:prose-invert max-w-none">
                    <h1 className="text-4xl font-bold tracking-tight mb-4 bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                        Privacy Policy for AmoNexus - Mindful Browsing
                    </h1>
                    <p className="text-muted-foreground mb-8">
                        Last Updated: January 2026
                    </p>

                    <section className="space-y-8">
                        {/* 1. Introduction */}
                        <div>
                            <h2 className="text-2xl font-bold mt-8 mb-4">1. Introduction</h2>
                            <p className="text-muted-foreground">
                                AmoNexus - Mindful Browsing ("we", "our", or "the extension") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our Chrome Extension.
                            </p>
                            <div className="p-4 bg-muted rounded-lg mt-4 border-l-4 border-primary">
                                <strong>Core Principle:</strong> We do not track, sell, or transmit your personal browsing history to any external servers owned by us. Your data primarily lives on your device.
                            </div>
                        </div>

                        {/* 2. Information We Collect */}
                        <div>
                            <h2 className="text-2xl font-bold mt-8 mb-4">2. Information We Collect & How We Use It</h2>

                            <div className="space-y-6">
                                <div className="bg-card border border-border p-6 rounded-xl">
                                    <h3 className="text-lg font-semibold mb-2">A. Browsing Activity (Local Processing)</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                        <li><strong>Data:</strong> The extension monitors the URLs of the websites you visit and the time spent on them.</li>
                                        <li><strong>Purpose:</strong> This data is processed locally on your device to detect "doomscrolling" patterns (extended usage duration) and to trigger interventions (such as breathing exercises or blockage screens) based on your sensitivity settings.</li>
                                        <li><strong>Storage:</strong> This behavioral data is stored locally using <code>chrome.storage.local</code> and is not transmitted to our servers.</li>
                                    </ul>
                                </div>

                                <div className="bg-card border border-border p-6 rounded-xl">
                                    <h3 className="text-lg font-semibold mb-2">B. User Input (Journaling)</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                        <li><strong>Data:</strong> Text entries, emotional states (emojis), and tags you voluntarily input into the "Journal" feature.</li>
                                        <li><strong>Purpose:</strong> To help you reflect on your browsing habits and emotional triggers.</li>
                                        <li><strong>Storage:</strong> Stored locally on your device.</li>
                                    </ul>
                                </div>

                                <div className="bg-card border border-border p-6 rounded-xl">
                                    <h3 className="text-lg font-semibold mb-2">C. API Keys</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                        <li><strong>Data:</strong> Your personal Google Gemini API Key.</li>
                                        <li><strong>Purpose:</strong> To authenticate requests sent to Google's Generative AI services for the purpose of analyzing your journal entries and providing personalized advice.</li>
                                        <li><strong>Storage:</strong> Stored securely in <code>chrome.storage.local</code>.</li>
                                    </ul>
                                </div>

                                <div className="bg-card border border-border p-6 rounded-xl">
                                    <h3 className="text-lg font-semibold mb-2">D. User Settings (Safe Zone / Whitelist)</h3>
                                    <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                        <li><strong>Data:</strong> The list of specific website domains that you manually designate as "Safe Zones" (Whitelist) via the context menu.</li>
                                        <li><strong>Purpose:</strong> To exempt these specific websites from the extension's tracking and intervention logic, ensuring uninterrupted work or study sessions.</li>
                                        <li><strong>Storage:</strong> This list is strictly stored locally on your device using <code>chrome.storage.local</code>.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 3. Third-Party Services */}
                        <div>
                            <h2 className="text-2xl font-bold mt-8 mb-4">3. Third-Party Services (Google Gemini AI)</h2>
                            <p className="text-muted-foreground mb-4">
                                This extension uses Google Gemini API (Generative AI) to provide smart analysis and personalized advice.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li><strong>Data Transmission:</strong> When you use the "Journal" or "Analyze" features, the text of your journal entry and strictly limited context (current website domain, duration) are sent directly from your browser to Google's servers via their API.</li>
                                <li><strong>No Intermediary:</strong> This data goes directly to Google; it does not pass through any server owned by the AmoNexus developer.</li>
                                <li><strong>Governance:</strong> The processing of this data is subject to Google's Generative AI Terms of Service and Google Privacy Policy.</li>
                            </ul>
                        </div>

                        {/* 4. Permissions Justification */}
                        <div>
                            <h2 className="text-2xl font-bold mt-8 mb-4">4. Permissions Justification</h2>
                            <p className="text-muted-foreground mb-4">To function effectively, AmoNexus requires specific permissions:</p>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li><code>tabs & &lt;all_urls&gt;</code>: Required to monitor active time on websites to prevent addiction and verify if a site is in your "Safe Zone" (Whitelist).</li>
                                <li><code>storage</code>: Required to save your settings, whitelist, and journal logs locally.</li>
                                <li><code>scripting</code>: Required to display the overlay (interventions) on top of web pages.</li>
                            </ul>
                        </div>

                        {/* 5. Data Retention & Deletion */}
                        <div>
                            <h2 className="text-2xl font-bold mt-8 mb-4">5. Data Retention & Deletion</h2>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li><strong>Retention:</strong> All data is retained locally on your browser until you remove the extension.</li>
                                <li><strong>Deletion:</strong> You can clear all stored data at any time by clicking the "Clear Data" (Reset) button in the extension popup or by uninstalling the extension.</li>
                            </ul>
                        </div>

                        {/* 6. Contact Us */}
                        <div>
                            <h2 className="text-2xl font-bold mt-8 mb-4">6. Contact Us</h2>
                            <p className="text-muted-foreground">
                                If you have any questions about this Privacy Policy, please contact the developer at:
                            </p>
                            <ul className="list-none pl-6 mt-2 text-muted-foreground">
                                <li>• Email: <a href="mailto:dnqduy.0611@gmail.com" className="text-primary hover:underline">dnqduy.0611@gmail.com</a></li>
                            </ul>
                        </div>
                    </section>
                </article>
            </div>
            <Footer />
        </main>
    )
}

export default function PrivacyPolicy() {
    return (
        <ThemeProvider>
            <LanguageProvider>
                <PrivacyPolicyContent />
            </LanguageProvider>
        </ThemeProvider>
    )
}
