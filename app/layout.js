import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SYSTEM_NAME } from "@/lib/constants/brand";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/settings/theme";

export const metadata = {
  title: SYSTEM_NAME,
  description: `${SYSTEM_NAME} — Cambaog National High School`,
  icons: {
    icon: "/cnhs-logo.png",
    apple: "/cnhs-logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="cnhs-theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
