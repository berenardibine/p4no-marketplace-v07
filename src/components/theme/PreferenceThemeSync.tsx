import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useUserPreferences } from "@/hooks/useUserPreferences";

/**
 * Keeps next-themes in sync with the user's saved preferences (Supabase).
 * - Prefers `user_preferences.theme` if present.
 * - Falls back to `user_preferences.dark_mode`.
 */
const PreferenceThemeSync = () => {
  const { preferences } = useUserPreferences();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const desired =
      (preferences?.theme as string | undefined) ??
      (preferences?.dark_mode ? "dark" : "light");

    if (!desired) return;
    if (theme !== desired) {
      setTheme(desired);
    }
  }, [preferences?.theme, preferences?.dark_mode, setTheme, theme]);

  return null;
};

export default PreferenceThemeSync;
