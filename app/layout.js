import "./globals.css";

export const metadata = {
  title: "Accounting System",
  description: "Persistent household ledger and monthly settlement dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
