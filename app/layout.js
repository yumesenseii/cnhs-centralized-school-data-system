import "./globals.css";

export const metadata = {
  title: "CNHS Centralized School Data System",
  description: "Admin and Teacher portal for CNHS Centralized School Data System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
