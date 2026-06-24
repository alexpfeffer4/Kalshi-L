import fs from "node:fs";
import path from "node:path";

import "./globals.css";

const globalStyles = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

export const metadata = {
  title: "Kalshi L Notifier",
  description: "Monitor lawsuits, losses, regulatory heat, and bad press around Kalshi.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
