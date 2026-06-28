import "./globals.css";

export const metadata = {
  title: "Kalshi L Notifier",
  description: "Monitor lawsuits, losses, regulatory heat, and bad press around Kalshi.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
