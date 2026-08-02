"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppearanceCard from "@/components/settings/AppearanceCard";
import PersonalAccountCard from "@/components/settings/PersonalAccountCard";
import SchoolInformationCard from "@/components/settings/SchoolInformationCard";
import SecurityCard from "@/components/settings/SecurityCard";
import SettingsHeader from "@/components/settings/SettingsHeader";
import SettingsSidebar from "@/components/settings/SettingsSidebar";
import SystemInformationCard from "@/components/settings/SystemInformationCard";
import { settingsData } from "@/data/settings";
import { getAdminSettingsProfile } from "@/lib/supabase/queries/adminAuth";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("school");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [account, setAccount] = useState(null);
  const [security, setSecurity] = useState(null);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError("");
    const result = await getAdminSettingsProfile();
    if (result.error) {
      setProfileError(result.error.message || "Unable to load profile.");
      setAccount(null);
      setSecurity(null);
    } else {
      setAccount(result.data.account);
      setSecurity(result.data.security);
    }
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  function handlePasswordChanged() {
    setSecurity((prev) =>
      prev
        ? {
            ...prev,
            mustChangePassword: false,
            tempPassword: "",
          }
        : prev
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <SettingsHeader />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <SettingsSidebar
            items={settingsData.menu}
            activeId={activeSection}
            onSelect={setActiveSection}
          />
        </aside>

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {activeSection === "school" ? (
                <SchoolInformationCard school={settingsData.school} />
              ) : null}
              {activeSection === "account" ? (
                <PersonalAccountCard
                  account={account}
                  loading={profileLoading}
                  error={profileError}
                  onGoToSecurity={() => setActiveSection("security")}
                />
              ) : null}
              {activeSection === "appearance" ? (
                <AppearanceCard appearance={settingsData.appearance} />
              ) : null}
              {activeSection === "security" ? (
                <SecurityCard
                  security={security}
                  loading={profileLoading}
                  error={profileError}
                  onPasswordChanged={handlePasswordChanged}
                />
              ) : null}
              {activeSection === "system" ? (
                <SystemInformationCard system={settingsData.system} />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
