import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import frontendImg from "../assets/images/frontend-development.webp";
import englishImg from "../assets/images/English-lang-course.webp";
import interpretationImg from "../assets/images/Simultaneous-Interpretation.webp";
import humanresourcesImg from "../assets/images/Human-resources.webp";

const courses = [
  {
    id: 1,
    title: "Frontend Development",
    instructor: "Omar Gouda",
    level: "Beginner - Intermediate",
    duration: "8 Weeks",
    img: frontendImg,
    link: "/courses/frontend",
    extra: "+ Frameworks Coming Soon",
    description:
      "Build your web development foundation step by step with HTML, CSS, and JavaScript. This course gives you the skills to create modern, responsive websites and prepares you for more advanced tools.",
  },
  {
    id: 2,
    title: "English Language",
    instructor: "Mariam Ramadan",
    level: "All Levels",
    duration: "6 Weeks",
    img: englishImg,
    link: "/courses/english",
    description:
      "Enhance your English communication skills and build confidence in real-world use. Each student follows a personalized learning plan designed to ensure steady progress and maximum benefit from the course.",
  },
  {
    id: 3,
    title: "Simultaneous Interpretation",
    instructor: "Mariam Ramadan",
    level: "Advanced",
    duration: "12 Weeks",
    img: interpretationImg,
    link: "/courses/interpretation",
    description:
      "Train to become a professional simultaneous interpreter. This course is tailored for advanced learners and provides the expertise needed to excel in academic, professional, and global settings.",
  },
  {
    id: 4,
    title: "Human Resources Management",
    instructor: "Abdelrahman Fouad",
    level: "Beginner",
    duration: "12 Weeks",
    img: humanresourcesImg,
    link: "/courses/hr",
    description:
      "Unlock the full potential of your career in Human Resources with our comprehensive course designed for aspiring HR professionals and managers.",
  },
];

const FeaturedCourses = () => {
  return (
    <section id="courses" className="bg-background py-16" aria-labelledby="courses-title">
      <h3 id="courses-title" className="section-title mb-12 text-center text-3xl font-bold text-text md:text-4xl">
        Featured Courses
      </h3>

      <div className="grid gap-8 px-4 md:grid-cols-2 md:px-8 lg:grid-cols-2">
        {courses.map((course) => (
          <motion.article
            key={course.id}
            className="relative cursor-pointer overflow-hidden rounded-xl bg-white shadow-lg transition-shadow duration-300 hover:shadow-2xl"
            whileHover={{ scale: 1.03 }}
          >
            <div className="p-4">
              <img
                src={course.img}
                alt={course.title}
                className="mb-4 h-48 w-full rounded-lg object-cover"
              />
              <h4 className="mb-1 text-xl font-semibold">{course.title}</h4>
              <p className="mb-2 text-sm text-gray-600">
                Instructor: <strong>{course.instructor}</strong>
              </p>
              <span className="mr-2 inline-block rounded bg-primary/20 px-2 py-1 text-xs font-medium text-primary">
                {course.level}
              </span>
              {course.extra ? (
                <span className="inline-block rounded bg-secondary/20 px-2 py-1 text-xs font-medium text-secondary">
                  {course.extra}
                </span>
              ) : null}
            </div>

            <div className="border-t border-gray-200 p-4">
              <h4 className="mb-2 text-lg font-semibold">{course.title}</h4>
              <p className="mb-4 text-gray-700">{course.description}</p>
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded bg-accent/20 px-2 py-1 text-xs font-medium text-accent">
                  {course.duration}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={course.link}
                  className="rounded-lg bg-primary px-4 py-2 text-white transition hover:bg-secondary"
                >
                  Learn More
                </Link>
                <Link
                  to="/teachers"
                  className="rounded-lg border border-primary px-4 py-2 text-primary transition hover:bg-accent/20"
                >
                  Meet the Instructor
                </Link>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

export default FeaturedCourses;
