import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import heroImg from "../assets/images/Hero-img.webp";

const HeroSection = () => {
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-background"
      role="region"
      aria-label="Hero Section"
    >
      <div className="container mx-auto flex flex-col items-center justify-between gap-10 px-6 py-16 md:flex-row md:py-24">
        <motion.div
          className="flex flex-col gap-5 text-center md:w-1/2 md:text-left"
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-primary md:text-base">
            Education for Tomorrow
          </span>

          <h1 className="text-3xl font-bold leading-tight text-text md:text-5xl">
            Practical Courses that Shape Your Future
          </h1>

          <p className="text-lg leading-relaxed text-text/80 md:text-xl">
            edUKai bridges knowledge and practice with hands-on learning in tech,
            English, and translation, designed for ambitious learners like you.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-4 sm:flex-row md:justify-start">
            <Link
              to="/courses"
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white shadow-md transition-all duration-300 hover:bg-secondary"
            >
              Explore Courses
            </Link>

            <Link
              to="/about"
              className="flex items-center justify-center gap-2 rounded-lg border border-primary px-6 py-3 font-medium text-primary transition-all duration-300 hover:bg-accent/30"
            >
              <i className="fa-regular fa-circle-play" /> Start your journey
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="flex justify-center md:w-1/2"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        >
          <div className="relative w-full max-w-md md:max-w-lg">
            <img
              src={heroImg}
              alt="edUKai Hero"
              className="w-full rounded-2xl object-cover shadow-lg"
              loading="lazy"
            />
            <motion.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-t from-background/40 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.2 }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
