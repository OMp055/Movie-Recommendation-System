import { motion } from 'framer-motion';

export const FluidBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-background">
      {/* Dark overlay to ensure contrast for text */}
      <div className="absolute inset-0 bg-black/60 z-10 backdrop-blur-[100px]" />
      
      {/* Primary Blob */}
      <motion.div
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -100, 50, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
        className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/40 mix-blend-screen filter blur-[120px] opacity-70"
      />

      {/* Secondary Blob */}
      <motion.div
        animate={{
          x: [0, -150, 100, 0],
          y: [0, 150, -100, 0],
          scale: [1, 1.5, 0.9, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
          delay: 2,
        }}
        className="absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-purple-600/40 mix-blend-screen filter blur-[120px] opacity-60"
      />

      {/* Tertiary Blob */}
      <motion.div
        animate={{
          x: [0, 100, -150, 0],
          y: [0, -50, 100, 0],
          scale: [1, 1.1, 1.3, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
          delay: 5,
        }}
        className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-blue-600/30 mix-blend-screen filter blur-[140px] opacity-60"
      />
    </div>
  );
};
