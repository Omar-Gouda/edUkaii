import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const JobAds = () => {
  const navigate = useNavigate();

  const jobs = [
    {
      id: 1,
      title: "Frontend Developer",
      department: "Development",
      location: "Remote / Cairo Office",
      type: "Full-Time",
      description:
        "Work on modern web interfaces using React and Tailwind CSS to deliver world-class learning experiences.",
    },
    {
      id: 2,
      title: "HR Instructor",
      department: "Education",
      location: "Remote / Hybrid",
      type: "Part-Time",
      description:
        "Teach Human Resources concepts and real-world applications to students in our mentorship-based courses.",
    },
    {
      id: 3,
      title: "English Language Instructor",
      department: "Education",
      location: "Remote / Alexandria Office",
      type: "Part-Time",
      description:
        "Guide learners through English grammar, fluency, and communication skills in engaging sessions.",
    },
    {
      id: 4,
      title: "Marketing Specialist",
      department: "Marketing",
      location: "Cairo Office",
      type: "Full-Time",
      description:
        "Manage digital campaigns and content strategy to promote edUKai’s mission and attract new learners.",
    },
    {
      id: 5,
      title: "UI/UX Designer",
      department: "Design",
      location: "Remote",
      type: "Full-Time",
      description:
        "Design intuitive interfaces and delightful user experiences for our web and mobile learning products.",
    },
  ];

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("All");

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filter === "All" || job.department === filter;

    return matchesSearch && matchesFilter;
  });

  const handleApply = (jobTitle) => {
    navigate("/careers", { state: { position: jobTitle } });
  };

  return (
    <section className="bg-background text-text py-16 px-6">
      <div className="container mx-auto max-w-7xl">
        {/* Title */}
        <h2 className="text-3xl font-bold text-center text-primary mb-10">
          Current Job Openings
        </h2>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10">
          <input
            type="text"
            placeholder="Search by title, department, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-2/3 px-4 py-2 rounded-xl bg-accent/30 placeholder:text-text/60 border border-white/20 focus:border-primary outline-none transition"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full md:w-1/3 px-4 py-2 rounded-xl bg-accent/30 text-text/60 border border-white/20 focus:border-primary outline-none transition"
          >
            <option value="All">All Departments</option>
            <option value="Development">Development</option>
            <option value="Education">Education</option>
            <option value="Marketing">Marketing</option>
            <option value="Design">Design</option>
          </select>
        </div>

        {/* Job Cards */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredJobs.length > 0 ? (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white/5 p-6 rounded-2xl shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-1"
              >
                <h3 className="text-xl font-semibold text-primary mb-2">
                  {job.title}
                </h3>
                <p className="text-sm text-text/80 mb-3">
                  <span className="font-medium">{job.department}</span> •{" "}
                  {job.location} • {job.type}
                </p>
                <p className="text-text/90 mb-4">{job.description}</p>

                <button
                  onClick={() => handleApply(job.title)}
                  className="inline-block bg-primary text-white font-medium px-4 py-2 rounded-lg hover:bg-primary/80 transition"
                >
                  Apply Now
                </button>
              </div>
            ))
          ) : (
            <p className="text-center text-text/70 w-full">
              No job openings match your search.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default JobAds;
