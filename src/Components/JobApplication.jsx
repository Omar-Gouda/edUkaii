import { useState } from "react";
import { motion } from "framer-motion";

const TagInput = ({ label, name, tags, setTags, placeholder }) => {
  const [input, setInput] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = input.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setInput("");
    }
  };

  const removeTag = (tag) => setTags(tags.filter((t) => t !== tag));

  return (
    <div className="col-span-2">
      <label className="block font-medium mb-1">{label}</label>
      <div className="flex flex-wrap items-center gap-2 border border-gray-300 rounded-lg p-3 bg-accent/10">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-red-500 font-bold"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          type="text"
          name={name}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-text"
        />
      </div>
    </div>
  );
};

const JobApplication = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    position: "",
    coverLetter: "",
    cv: null,
  });

  const [skills, setSkills] = useState([]);
  const [linkedInProfiles, setLinkedInProfiles] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [newExp, setNewExp] = useState({
    company: "",
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    currentlyWorking: false,
  });

  const [submitted, setSubmitted] = useState(false);

  const jobPositions = [
    "Frontend Development Instructor",
    "English Language Instructor",
    "Human Resources Instructor",
    "Interpretation Instructor",
    "Frontend Developer",
    "Content Creator / Copywriter",
    "Graphic Designer / Video Editor",
    "Social Media Manager",
    "Recruitment Specialist",
    "Customer Support Agent",
  ];

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData({ ...formData, [name]: files ? files[0] : value });
  };

  const handleExperienceChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewExp({
      ...newExp,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const addExperience = () => {
    if (!newExp.company || !newExp.title) return;
    setExperiences([...experiences, newExp]);
    setNewExp({
      company: "",
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      currentlyWorking: false,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalData = {
      ...formData,
      skills,
      linkedInProfiles,
      portfolios,
      experiences,
    };
    console.log("Submitted Application:", finalData);
    setSubmitted(true);
  };

  if (submitted)
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-20"
      >
        <h2 className="text-3xl font-bold text-primary mb-4">
          🎉 Application Submitted!
        </h2>
        <p className="text-text/80 max-w-xl mx-auto">
          Thank you for applying to <span className="text-primary">edUKai</span>.
          Our recruitment team will review your application soon.
        </p>
      </motion.div>
    );

  return (
    <section className="py-20 bg-background text-text px-6">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-8 text-center">
          Join Our Team
        </h2>
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
          {/* Basic Info */}
          <input
            type="text"
            name="fullName"
            required
            placeholder="Full Name"
            value={formData.fullName}
            onChange={handleChange}
            className="col-span-2 md:col-span-1 border border-gray-300 rounded-lg p-3 bg-accent/10"
          />
          <input
            type="email"
            name="email"
            required
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className="col-span-2 md:col-span-1 border border-gray-300 rounded-lg p-3 bg-accent/10"
          />
          <input
            type="tel"
            name="phone"
            required
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            className="col-span-2 md:col-span-1 border border-gray-300 rounded-lg p-3 bg-accent/10"
          />
          <select
            name="position"
            required
            value={formData.position}
            onChange={handleChange}
            className="col-span-2 md:col-span-1 border border-gray-300 rounded-lg p-3 bg-accent/10"
          >
            <option value="">Select a position</option>
            {jobPositions.map((job, i) => (
              <option key={i} value={job}>
                {job}
              </option>
            ))}
          </select>

          {/* Experience Section */}
          <div className="col-span-2">
            <h3 className="text-lg font-semibold mb-3 text-primary">Experience</h3>
            <div className="grid md:grid-cols-2 gap-3 bg-accent/10 p-4 rounded-lg">
              <input
                type="text"
                name="company"
                placeholder="Company Name"
                value={newExp.company}
                onChange={handleExperienceChange}
                className="border p-2 rounded-md bg-accent/15 text-text"
              />
              <input
                type="text"
                name="title"
                placeholder="Job Title"
                value={newExp.title}
                onChange={handleExperienceChange}
                className="border p-2 rounded-md bg-accent/15 text-text"
              />
              <textarea
                name="description"
                placeholder="Job Description"
                value={newExp.description}
                onChange={handleExperienceChange}
                className="col-span-2 border p-2 rounded-md bg-accent/15 text-text"
              />
              <input
                type="date"
                name="startDate"
                value={newExp.startDate}
                onChange={handleExperienceChange}
                className="border p-2 rounded-md bg-accent/10 text-text"
              />
              {!newExp.currentlyWorking && (
                <input
                  type="date"
                  name="endDate"
                  value={newExp.endDate}
                  onChange={handleExperienceChange}
                  className="border p-2 rounded-md bg-accent/10 text-text"
                />
              )}
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="currentlyWorking"
                  checked={newExp.currentlyWorking}
                  onChange={handleExperienceChange}
                />
                Currently Working Here
              </label>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                onClick={addExperience}
                className="col-span-2 bg-primary text-white px-4 py-2 rounded-lg mt-2"
              >
                Add Experience +
              </motion.button>
            </div>

            {experiences.length > 0 && (
              <div className="mt-4 space-y-3">
                {experiences.map((exp, i) => (
                  <div
                    key={i}
                    className="border border-accent/40 rounded-lg p-3 bg-accent/5"
                  >
                    <p className="font-semibold">{exp.title}</p>
                    <p className="text-sm text-mutedText">{exp.company}</p>
                    <p className="text-sm mt-1">{exp.description}</p>
                    <p className="text-xs text-mutedText mt-1">
                      {exp.startDate} →{" "}
                      {exp.currentlyWorking ? "Present" : exp.endDate}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <TagInput
            label="Skills"
            name="skills"
            tags={skills}
            setTags={setSkills}
            placeholder="Type a skill and press Enter"
          />
          <TagInput
            label="LinkedIn Profiles"
            name="linkedin"
            tags={linkedInProfiles}
            setTags={setLinkedInProfiles}
            placeholder="Paste LinkedIn URL and press Enter"
          />
          <TagInput
            label="Portfolio Links"
            name="portfolio"
            tags={portfolios}
            setTags={setPortfolios}
            placeholder="Paste link and press Enter"
          />

          {/* Cover Letter */}
          <textarea
            name="coverLetter"
            required
            placeholder="Why do you want to join edUKai?"
            value={formData.coverLetter}
            onChange={handleChange}
            className="col-span-2 border border-gray-300 rounded-lg p-3 bg-accent/15 h-32"
          />

          {/* CV Upload */}
          <input
            type="file"
            name="cv"
            accept=".pdf,.doc,.docx"
            required
            onChange={handleChange}
            className="col-span-2 border border-gray-300 rounded-lg p-3 bg-gray-50"
          />

          {/* Submit */}
          <div className="col-span-2 text-center mt-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="bg-primary text-white font-semibold px-8 py-3 rounded-xl hover:bg-secondary transition-all"
            >
              Submit Application
            </motion.button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default JobApplication;
