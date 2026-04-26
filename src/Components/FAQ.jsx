import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqData = [
  {
    question: "Are the sessions live or recorded?",
    answer: "Most sessions are live with replays available so you never miss out.",
  },
  {
    question: "Do I get a certificate?",
    answer: "Yes! Every completed course comes with a shareable certificate.",
  },
  {
    question: "How do I enroll?",
    answer: 'Click "Enroll Now," pay the deposit, and receive your roadmap instantly.',
  },
  // تقدر تضيف أي أسئلة جديدة هنا بسهولة
];

const FAQ = () => {
  const [activeIndex, setActiveIndex] = useState(null);

  const toggleFAQ = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <section
      aria-labelledby="faq-title"
      className="py-12 px-6 md:px-16 bg-background rounded-xl my-12"
    >
      <h3
        id="faq-title"
        className="text-3xl md:text-4xl font-bold mb-8 text-center"
      >
        Frequently Asked Questions
      </h3>

      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        {faqData.map((item, index) => (
          <div key={index} className="border border-accent/30 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFAQ(index)}
              className="w-full flex justify-between items-center px-4 py-3 bg-accent/10 hover:bg-accent/20 transition"
            >
              <span className="text-left font-medium">{item.question}</span>
              <motion.div
                animate={{ rotate: activeIndex === index ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown />
              </motion.div>
            </button>

            <AnimatePresence>
              {activeIndex === index && (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="px-4 py-3 bg-background"
                >
                  <p className="text-text/90">{item.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FAQ;
