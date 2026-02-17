"use client"

import { motion } from "framer-motion"
import { useTheme } from "@/lib/theme-context"

export function AtomOrb() {
  const { theme } = useTheme()

  return (
    <div className="relative w-64 h-64 md:w-80 md:h-80">
      {/* Outer glow layers - adjusted opacity for theme */}
      <motion.div
        className={`absolute inset-0 rounded-full ${theme === "dark" ? "bg-primary/10" : "bg-primary/15"} blur-3xl`}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className={`absolute inset-8 rounded-full ${theme === "dark" ? "bg-primary/20" : "bg-primary/25"} blur-2xl`}
        animate={{
          scale: [1.1, 1, 1.1],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: 3,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 0.5,
        }}
      />

      {/* Main orb with antigravity float */}
      <motion.div
        className="absolute inset-12 rounded-full bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] shadow-[0_0_60px_rgba(16,185,129,0.5)]"
        animate={{
          y: [0, -20, 0],
        }}
        transition={{
          duration: 4,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      >
        {/* Inner highlight */}
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/20 to-transparent" />

        {/* Core glow */}
        <motion.div
          className="absolute inset-8 rounded-full bg-primary/50 blur-md"
          animate={{
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      {/* Orbiting particles */}
      {[0, 120, 240].map((rotation, i) => (
        <motion.div
          key={i}
          className="absolute inset-0"
          style={{ rotate: `${rotation}deg` }}
          animate={{
            rotate: [rotation, rotation + 360],
          }}
          transition={{
            duration: 20 + i * 5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        >
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(16,185,129,0.8)]"
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          />
        </motion.div>
      ))}
    </div>
  )
}
