import "./globals.css";

export const metadata = {
  title: "Valyria Site Tracker",
  description: "Tracks how complete and up to date the Valyria Studios website is.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
