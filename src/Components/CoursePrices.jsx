import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import frontendImg from "../assets/images/frontend-development.webp";
import englishImg from "../assets/images/English-lang-course.webp";
import interpretationImg from "../assets/images/Simultaneous-Interpretation.webp";
import humanresourcesImg from "../assets/images/Human-resources.webp";

const CoursesSection = () => {
  const courses = [
    {
      title: "Frontend Development",
      img: frontendImg,
      instructor: "Omar Gouda",
      duration: "8 Weeks",
      level: "Beginner - Intermediate",
      description:
        "Master the art of modern web development using HTML, CSS, JavaScript, and React. Build beautiful, real-world projects step-by-step with expert guidance.",
      price: "3000 EGP",
      deposit: "750 EGP",
      extra: "Cheapest in the market",
      link: "/courses/frontend",
    },
    {
      title: "English Mastery",
      img: englishImg,
      instructor: "Mariam Ramadan",
      duration: "6 Weeks",
      level: "All Levels",
      description:
        "Transform your fluency with personalized lessons in reading, writing, and speaking. Learn confidently through Mariam's engaging, step-by-step approach.",
      price: "1200 EGP per level",
      deposit: "300 EGP",
      extra:
        "Initial test 120 EGP (refundable if not passed) -> After passing: complete deposit with 180 EGP",
      link: "/courses/english",
    },
    {
      title: "Interpretation Skills",
      img: interpretationImg,
      instructor: "Mariam Ramadan",
      duration: "6 Weeks",
      level: "Intermediate",
      description:
        "Train in professional Simultaneous and Consecutive Interpretation for academic, business, and real-world contexts.",
      price: "5000 EGP",
      deposit: "1250 EGP",
      extra:
        "Test 500 EGP (refundable if not passed) -> After passing: complete deposit with 750 EGP",
      link: "/courses/interpretation",
    },
    {
      title: "Human Resources Management",
      img: humanresourcesImg,
      instructor: "Abdelrahman Fouad",
      duration: "12 Weeks",
      level: "Beginner",
      description:
        "Learn how to attract, develop, and retain talent while building a strong company culture.",
      price: "2800 EGP",
      deposit: "750 EGP",
      extra: "First HR course in Egypt with practical training",
      link: "/courses/hr",
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
    <section className="overflow-hidden bg-gradient-to-b from-purple-50 via-white to-purple-50 px-6 py-24 font-[Inter] md:px-12">
      <motion.div
        className="mx-auto mb-20 max-w-6xl text-center"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        viewport={{ once: true }}
      >
        <h2 className="mb-6 text-5xl font-extrabold leading-snug tracking-tight text-purple-700 md:text-6xl font-[Playfair_Display]">
          Our Courses
        </h2>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-600 md:text-xl">
          Explore hands-on, founder-led courses designed to help you grow with purpose.
        </p>
      </motion.div>

      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 lg:grid-cols-2">
        {courses.map((course, i) => (
          <motion.article
            key={course.title}
            custom={i}
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-purple-100 bg-white/80 shadow-lg backdrop-blur-xl transition-all duration-500 hover:-translate-y-2 hover:border-purple-300 hover:shadow-2xl"
          >
            <div className="relative overflow-hidden">
              <motion.img
                src={course.img}
                alt={course.title}
                className="h-64 w-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-purple-900/40 to-transparent opacity-0 transition-all duration-500 hover:opacity-100" />
            </div>

            <div className="p-8">
              <h3 className="mb-3 text-2xl font-extrabold text-purple-700 font-[Playfair_Display]">
                {course.title}
              </h3>
              <p className="mb-6 text-base leading-relaxed text-gray-600">
                {course.description}
              </p>

              <div className="mb-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold tracking-wide text-purple-700">
                  Instructor: {course.instructor}
                </span>
                <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold tracking-wide text-purple-700">
                  Duration: {course.duration}
                </span>
                <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold tracking-wide text-purple-700">
                  Level: {course.level}
                </span>
              </div>

              <div className="rounded-2xl border border-purple-100 bg-purple-50 p-5 text-left shadow-inner transition-all hover:shadow-md">
                <p className="mb-2 font-semibold text-purple-700">{course.extra}</p>
                <p className="text-gray-700">
                  Price: <span className="font-bold">{course.price}</span>
                </p>
                <p className="text-gray-700">
                  Deposit: <span className="font-bold">{course.deposit}</span>
                </p>
              </div>

              <Link
                to={course.link}
                className="mt-6 inline-block rounded-full bg-purple-600 px-8 py-3 text-base font-semibold tracking-wide text-white shadow-md transition-all duration-300 hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-300"
              >
                View Details
              </Link>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

export default CoursesSection;
