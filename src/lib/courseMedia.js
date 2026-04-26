import frontendImg from "../assets/images/frontend-development.webp";
import englishImg from "../assets/images/English-lang-course.webp";
import interpretationImg from "../assets/images/Simultaneous-Interpretation.webp";
import hrImg from "../assets/images/Human-resources.webp";

const imageMap = {
  frontend: frontendImg,
  english: englishImg,
  interpretation: interpretationImg,
  hr: hrImg,
  technology: frontendImg,
  language: englishImg,
  business: hrImg,
};

export function resolveCourseImage(course) {
  if (course?.thumbnailUrl) {
    return course.thumbnailUrl;
  }

  return imageMap[course?.imageKey] || frontendImg;
}
