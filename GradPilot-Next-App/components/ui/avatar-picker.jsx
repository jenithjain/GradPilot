"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Spider-Verse glitch: burst in with chromatic skew + scale pop, then settle
const glitchVariants = {
  initial: {
    opacity: 0,
    scale: 1.18,
    skewX: -8,
    filter: "blur(4px) saturate(2.5) hue-rotate(30deg)",
  },
  animate: {
    opacity: 1,
    scale: 1,
    skewX: 0,
    filter: "blur(0px) saturate(1) hue-rotate(0deg)",
    transition: {
      opacity:  { duration: 0.06 },
      scale:    { type: "spring", stiffness: 420, damping: 22 },
      skewX:    { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
      filter:   { duration: 0.18, ease: "easeOut" },
    },
  },
  exit: {
    opacity: 0,
    scale: 0.84,
    skewX: 6,
    filter: "blur(3px) saturate(2) hue-rotate(-20deg)",
    transition: { duration: 0.14, ease: "easeIn" },
  },
};

// Ghost chromatic layer (red offset)
const ghostRedVariants = {
  initial: { opacity: 0.55, x: -6, scaleX: 1.04 },
  animate: { opacity: 0,    x:  0, scaleX: 1,    transition: { duration: 0.28, ease: "easeOut" } },
};

// Ghost chromatic layer (cyan offset)
const ghostCyanVariants = {
  initial: { opacity: 0.45, x:  6, scaleX: 1.04 },
  animate: { opacity: 0,    x:  0, scaleX: 1,    transition: { duration: 0.22, ease: "easeOut" } },
};

const containerVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const itemVariants = {
  initial: { y: 16, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 22 } },
};

export function AvatarPicker({ avatars, selectedId, onSelect }) {
  const selected = avatars.find((a) => a.id === selectedId) ?? avatars[0];

  const handleSelect = (avatar) => {
    if (avatar.id === selected.id) return;
    onSelect(avatar);
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={containerVariants}
      className="w-full"
    >
      {/* ── Gradient header band ── */}
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{
          opacity: 1,
          height: "7rem",
          transition: { height: { type: "spring", stiffness: 100, damping: 18 } },
        }}
        className={`w-full rounded-t-2xl bg-linear-to-r ${selected.accent} opacity-80`}
      />

      <div className="px-8 pb-8 -mt-16">
        {/* ── Large central preview with Spider-Verse glitch ── */}
        <div className="relative mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-3xl border-4 border-background bg-background shadow-2xl">
          <AnimatePresence mode="wait">
            {/* Red chromatic ghost */}
            <motion.div
              key={`red-${selected.id}`}
              variants={ghostRedVariants}
              initial="initial"
              animate="animate"
              className="pointer-events-none absolute inset-0 mix-blend-screen"
              style={{ filter: "saturate(3) sepia(1) hue-rotate(-30deg)", opacity: 0 }}
            >
              <Image src={selected.src} alt="" width={144} height={144}
                className="h-full w-full object-contain" aria-hidden />
            </motion.div>

            {/* Cyan chromatic ghost */}
            <motion.div
              key={`cyan-${selected.id}`}
              variants={ghostCyanVariants}
              initial="initial"
              animate="animate"
              className="pointer-events-none absolute inset-0 mix-blend-screen"
              style={{ filter: "saturate(3) sepia(1) hue-rotate(160deg)", opacity: 0 }}
            >
              <Image src={selected.src} alt="" width={144} height={144}
                className="h-full w-full object-contain" aria-hidden />
            </motion.div>

            {/* Main image */}
            <motion.div
              key={selected.id}
              variants={glitchVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full w-full"
            >
              <Image
                src={selected.src}
                alt={selected.name}
                width={144}
                height={144}
                className="h-full w-full object-contain drop-shadow-xl"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Name + subtitle ── */}
        <motion.div className="mt-4 text-center" variants={itemVariants}>
          <motion.h2
            key={selected.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="ivy-font text-2xl font-extrabold text-foreground"
          >
            {selected.name}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="ivy-font mt-0.5 text-sm text-muted-foreground"
          >
            {selected.desc}
          </motion.p>
        </motion.div>

        {/* ── Thumbnail picker row ── */}
        <motion.div
          className="mt-6 flex items-center justify-center gap-4"
          variants={containerVariants}
        >
          {avatars.map((avatar) => {
            const isSelected = avatar.id === selected.id;
            return (
              <motion.button
                key={avatar.id}
                onClick={() => handleSelect(avatar)}
                variants={itemVariants}
                whileHover={{ y: -3, transition: { duration: 0.18 } }}
                whileTap={{ scale: 0.93, transition: { duration: 0.12 } }}
                aria-label={`Select ${avatar.name}`}
                aria-pressed={isSelected}
                className={cn(
                  "relative h-16 w-16 overflow-hidden rounded-2xl border-2 transition-all duration-200",
                  isSelected
                    ? `border-transparent ring-2 ring-offset-2 ring-offset-background ${avatar.ringColor}`
                    : "border-border/50 opacity-60 hover:opacity-100"
                )}
              >
                <div className={`absolute inset-0 bg-linear-to-br ${avatar.accent} opacity-60`} />
                <Image
                  src={avatar.src}
                  alt={avatar.name}
                  width={64}
                  height={64}
                  className="relative h-full w-full object-contain p-1 drop-shadow"
                />
                {isSelected && (
                  <motion.div
                    layoutId="selectedRing"
                    className="absolute inset-0 rounded-2xl bg-white/10"
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  />
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}
