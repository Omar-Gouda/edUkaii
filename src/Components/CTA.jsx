import { Link } from "react-router-dom";

const CTABanner = () => {
  return (
    <section
      id="cta"
      aria-labelledby="cta-title"
      className="relative mx-6 mb-16 overflow-hidden rounded-xl bg-gradient-to-r from-purple-700 via-fuchsia-600 to-violet-500 py-20 text-white transition-shadow duration-300 hover:shadow-2xl md:mx-12 lg:mx-20"
    >
      <div className="absolute left-0 top-0 h-72 w-72 -translate-x-32 -translate-y-20 rounded-full bg-white/10" />
      <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-32 translate-y-20 rounded-full bg-white/10" />

      <div className="container relative z-10 mx-auto flex flex-col items-center justify-between gap-12 px-6 md:flex-row md:px-12">
        <div className="max-w-xl text-center md:text-left">
          <h3
            id="cta-title"
            className="mb-4 text-4xl font-extrabold drop-shadow-lg md:text-5xl"
          >
            Ready to transform your future?
          </h3>
          <p className="text-lg text-white/90 md:text-xl">
            Join edUKai today, limited seats for personalized mentorship. Let&apos;s
            start your journey to success!
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="rounded-xl bg-yellow-400 px-8 py-4 text-center font-bold text-gray-900 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:shadow-2xl"
          >
            Register Now
          </Link>
          <Link
            to="/courses"
            className="rounded-xl bg-white/90 px-8 py-4 text-center font-bold text-purple-700 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:shadow-2xl"
          >
            Browse Courses
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CTABanner;
