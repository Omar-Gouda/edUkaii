import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const HowItWorksSection = () => {
  const steps = [
    {
      number: "1",
      title: "Choose Your Course",
      description:
        "Pick the course that matches your goals, from Frontend Development to English Mastery.",
    },
    {
      number: "2",
      title: "Secure Your Spot",
      description:
        "Reserve your seat with a small deposit. Limited spots available for personalized mentorship.",
    },
    {
      number: "3",
      title: "Start Learning",
      description:
        "Join live sessions, access materials, and get real feedback directly from your instructors.",
    },
  ];

  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    show: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.2, duration: 0.6, ease: "easeOut" },
    }),
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-purple-50 to-white px-6 py-24 font-[Inter] md:px-12">
      <motion.div
        className="mb-16 text-center"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        viewport={{ once: true }}
      >
        <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-purple-700 md:text-5xl font-[Playfair_Display]">
          How Enrollment Works
        </h2>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-600 md:text-xl">
          Follow these simple steps to start your learning journey with us.
        </p>
      </motion.div>

      <div className="relative mx-auto max-w-5xl before:absolute before:left-1/2 before:top-0 before:hidden before:h-full before:w-1 before:-translate-x-1/2 before:bg-purple-200 md:before:block">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className={`relative mb-16 flex flex-col items-center gap-6 md:flex-row md:gap-12 ${
              i % 2 === 0 ? "md:flex-row-reverse" : ""
            }`}
          >
            <motion.div
              whileHover={{ scale: 1.15 }}
              className="z-10 flex h-14 w-14 items-center justify-center rounded-full border-4 border-purple-100 bg-purple-600 text-xl font-bold text-white shadow-lg"
            >
              {step.number}
            </motion.div>

            <div className="absolute left-[50%] top-7 h-full w-[2px] -translate-x-1/2 bg-purple-200 md:hidden" />

            <div className="max-w-md rounded-2xl border border-purple-100 bg-white/80 p-8 shadow-md backdrop-blur-xl transition-all duration-500 hover:border-purple-300 hover:shadow-xl">
              <h3 className="mb-3 text-2xl font-bold text-purple-700 font-[Playfair_Display]">
                {step.title}
              </h3>
              <p className="leading-relaxed text-gray-600">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-16 text-center"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        viewport={{ once: true }}
      >
        <Link
          to="/signup"
          className="inline-block rounded-full bg-purple-600 px-10 py-3 text-lg font-semibold tracking-wide text-white shadow-md transition-all duration-300 hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-300"
        >
          Start Your Journey Today
        </Link>
      </motion.div>
    </section>
  );
};

export default HowItWorksSection;
