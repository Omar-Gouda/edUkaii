import { useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Award, BadgeCheck, Mail, ShieldCheck, UserRound } from "lucide-react";
import { PageHero, SectionHeader, SiteLayout } from "../Components/SiteLayout";
import { AuthContext } from "../context/AuthContext";
import { api } from "../lib/api";

function avatarInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "EU";
}

export default function ProfileSettings() {
  const { user, loading, isAuthenticated, updateUser } = useContext(AuthContext);
  const [profileValues, setProfileValues] = useState({
    displayName: "",
    phone: "",
    bio: "",
    focusTrack: "Career Switch",
    privateBadges: false,
    achievementsText: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [emailValues, setEmailValues] = useState({ newEmail: "", currentPassword: "" });
  const [passwordValues, setPasswordValues] = useState({ currentPassword: "", newPassword: "" });
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfileValues({
      displayName: user.displayName || "",
      phone: user.phone || "",
      bio: user.bio || "",
      focusTrack: user.focusTrack || "Career Switch",
      privateBadges: Boolean(user.privateBadges),
      achievementsText: (user.achievements || []).join("\n"),
    });
    setAvatarPreview(user.avatarUrl || "");
    setEmailValues({ newEmail: user.email || "", currentPassword: "" });
    setPasswordValues({ currentPassword: "", newPassword: "" });
  }, [user]);

  const visibleBadges = useMemo(
    () => (user?.badges || []).filter((badge) => !user.privateBadges || badge.public),
    [user],
  );

  if (!loading && !isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (!user) {
    return (
      <SiteLayout>
        <section className="bg-background px-6 py-20 md:px-12">
          <div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 text-center shadow-lg">
            <p className="text-lg font-semibold text-primary">Loading your profile...</p>
          </div>
        </section>
      </SiteLayout>
    );
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileMessage("");

    try {
      const nextUser = await updateUser({
        displayName: profileValues.displayName,
        phone: profileValues.phone,
        bio: profileValues.bio,
        focusTrack: profileValues.focusTrack,
        privateBadges: profileValues.privateBadges,
        achievements: profileValues.achievementsText
          .split("\n")
          .map((entry) => entry.trim())
          .filter(Boolean),
      });

      setProfileValues((current) => ({
        ...current,
        achievementsText: (nextUser.achievements || []).join("\n"),
      }));
      setProfileMessage("Profile details updated successfully.");
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarSave(event) {
    event.preventDefault();

    if (!avatarFile) {
      setProfileError("Please choose an image first.");
      return;
    }

    setSavingAvatar(true);
    setProfileError("");
    setProfileMessage("");

    try {
      const payload = new FormData();
      payload.append("avatar", avatarFile);
      await api.post("/profile/avatar", payload);
      setAvatarFile(null);
      setProfileMessage("Profile photo updated successfully.");
      await updateUser({});
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setSavingAvatar(false);
    }
  }

  async function handleEmailSave(event) {
    event.preventDefault();
    setSavingEmail(true);
    setSecurityError("");
    setSecurityMessage("");

    try {
      await api.patch("/profile/email", emailValues);
      await updateUser({});
      setEmailValues((current) => ({ ...current, currentPassword: "" }));
      setSecurityMessage("Email address updated successfully.");
    } catch (error) {
      setSecurityError(error.message);
    } finally {
      setSavingEmail(false);
    }
  }

  async function handlePasswordSave(event) {
    event.preventDefault();
    setSavingPassword(true);
    setSecurityError("");
    setSecurityMessage("");

    try {
      await api.patch("/profile/password", passwordValues);
      setPasswordValues({ currentPassword: "", newPassword: "" });
      setSecurityMessage("Password changed successfully.");
    } catch (error) {
      setSecurityError(error.message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Profile settings"
        title="Keep your profile current, clear, and easy to recognize."
        description="Update how your name, photo, goals, badges, and account details appear across edUKai."
        actions={
          <>
            <Link to={`/people/${user.id}?preview=public`} className="primary-btn">
              Preview Public Profile
            </Link>
            <Link to={`/people/${user.id}`} className="secondary-btn !border-primary !text-primary">
              Open Full Profile
            </Link>
          </>
        }
      />

      <section className="bg-background px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-3xl bg-white p-8 shadow-lg">
            <SectionHeader
              eyebrow="Profile appearance"
              title="Public identity"
              description="Control the name, bio, learning direction, achievements, and badge visibility shown around the platform."
            />

            {profileError ? (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {profileError}
              </div>
            ) : null}

            {profileMessage ? (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {profileMessage}
              </div>
            ) : null}

            <form onSubmit={handleProfileSave} className="grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-text">
                  Display name
                  <input
                    value={profileValues.displayName}
                    onChange={(event) => setProfileValues((current) => ({ ...current, displayName: event.target.value }))}
                    className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-text">
                  Phone number
                  <input
                    type="tel"
                    value={profileValues.phone}
                    onChange={(event) => setProfileValues((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="0100 000 0000"
                    className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                  />
                  <span className="text-xs font-medium text-slate-500">
                    Keep this current for live payment checkouts and account follow-up.
                  </span>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-text">
                Bio
                <textarea
                  rows={5}
                  value={profileValues.bio}
                  onChange={(event) => setProfileValues((current) => ({ ...current, bio: event.target.value }))}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-text">
                Focus track
                <select
                  value={profileValues.focusTrack}
                  onChange={(event) => setProfileValues((current) => ({ ...current, focusTrack: event.target.value }))}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                >
                  <option>Career Switch</option>
                  <option>Academic Growth</option>
                  <option>Fluency</option>
                  <option>Professional Development</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-text">
                Achievements
                <textarea
                  rows={5}
                  value={profileValues.achievementsText}
                  onChange={(event) => setProfileValues((current) => ({ ...current, achievementsText: event.target.value }))}
                  placeholder="One achievement per line"
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-purple-100 bg-purple-50 px-5 py-4 text-sm font-semibold text-text">
                <div>
                  <p>Keep badges private</p>
                  <p className="mt-1 text-xs font-medium text-gray-600">You can still see them in your profile, but they will stay hidden from other users.</p>
                </div>
                <input
                  type="checkbox"
                  checked={profileValues.privateBadges}
                  onChange={(event) => setProfileValues((current) => ({ ...current, privateBadges: event.target.checked }))}
                  className="h-5 w-5 rounded border-purple-200 accent-primary"
                />
              </label>

              <button type="submit" disabled={savingProfile} className="primary-btn w-fit disabled:cursor-not-allowed disabled:opacity-70">
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </div>

          <div className="grid gap-8">
            <div className="rounded-3xl bg-white p-8 shadow-lg">
              <SectionHeader
                eyebrow="Profile photo"
                title="Update your photo"
                description="Keep your profile easy to recognize in courses, chats, and dashboards."
              />

              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-purple-100 text-2xl font-bold text-primary">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    avatarInitials(user.displayName)
                  )}
                </div>

                <form onSubmit={handleAvatarSave} className="grid flex-1 gap-4">
                  <label className="grid gap-2 text-sm font-semibold text-text">
                    Choose image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setAvatarFile(file);
                        if (file) {
                          setAvatarPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="rounded-xl border border-dashed border-purple-200 bg-white px-4 py-3 text-sm text-text outline-none"
                    />
                  </label>

                  <button type="submit" disabled={savingAvatar} className="primary-btn w-fit disabled:cursor-not-allowed disabled:opacity-70">
                    {savingAvatar ? "Uploading..." : "Save Photo"}
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-lg">
              <SectionHeader
                eyebrow="Recognition"
                title="Badges and certificates"
                description="Everything you earn stays visible here, ready to share publicly or keep only for yourself."
              />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-3">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700">
                    <BadgeCheck size={16} />
                    Visible badges
                  </div>
                  {visibleBadges.length ? (
                    visibleBadges.map((badge) => (
                      <div key={badge.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4">
                        <p className="font-bold text-primary">{badge.name}</p>
                        <p className="mt-2 text-sm text-gray-700">{badge.description}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4 text-sm text-gray-600">
                      Your visible badges will appear here as you earn them.
                    </div>
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-purple-700">
                    <Award size={16} />
                    Certificates
                  </div>
                  {(user.certificates || []).length ? (
                    user.certificates.map((certificate) => (
                      <div key={certificate.id} className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4">
                        <p className="font-bold text-primary">{certificate.title}</p>
                        <p className="mt-2 text-sm text-gray-700">
                          Issued {new Date(certificate.issuedAt).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4 text-sm text-gray-600">
                      Your certificates will appear here after course completion.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background px-6 pb-16 md:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-8 shadow-lg">
            <SectionHeader
              eyebrow="Email access"
              title="Change your email address"
              description="Move your account updates and notifications to an email you can access reliably."
            />

            {securityError ? (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {securityError}
              </div>
            ) : null}

            {securityMessage ? (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {securityMessage}
              </div>
            ) : null}

            <form onSubmit={handleEmailSave} className="grid gap-5">
              <label className="grid gap-2 text-sm font-semibold text-text">
                New email address
                <input
                  type="email"
                  value={emailValues.newEmail}
                  onChange={(event) => setEmailValues((current) => ({ ...current, newEmail: event.target.value }))}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text">
                Current password
                <input
                  type="password"
                  value={emailValues.currentPassword}
                  onChange={(event) => setEmailValues((current) => ({ ...current, currentPassword: event.target.value }))}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>

              <button type="submit" disabled={savingEmail} className="primary-btn w-fit disabled:cursor-not-allowed disabled:opacity-70">
                <Mail size={16} />
                {savingEmail ? "Saving..." : "Update Email"}
              </button>
            </form>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-lg">
            <SectionHeader
              eyebrow="Password"
              title="Change your password"
              description="Use a strong password with upper, lower, and numeric characters to keep your account protected."
            />

            <form onSubmit={handlePasswordSave} className="grid gap-5">
              <label className="grid gap-2 text-sm font-semibold text-text">
                Current password
                <input
                  type="password"
                  value={passwordValues.currentPassword}
                  onChange={(event) => setPasswordValues((current) => ({ ...current, currentPassword: event.target.value }))}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-text">
                New password
                <input
                  type="password"
                  value={passwordValues.newPassword}
                  onChange={(event) => setPasswordValues((current) => ({ ...current, newPassword: event.target.value }))}
                  className="rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm text-text outline-none transition focus:border-primary"
                />
              </label>

              <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-4 text-sm text-gray-700">
                <div className="inline-flex items-center gap-2 font-semibold text-purple-700">
                  <ShieldCheck size={16} />
                  Password guidance
                </div>
                <p className="mt-2">Choose at least 8 characters with uppercase, lowercase, and numbers.</p>
              </div>

              <button type="submit" disabled={savingPassword} className="primary-btn w-fit disabled:cursor-not-allowed disabled:opacity-70">
                <UserRound size={16} />
                {savingPassword ? "Saving..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
