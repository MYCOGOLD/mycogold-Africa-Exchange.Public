import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mycogold Africa Exchange",
  description: "A regional farmer-to-buyer marketplace powered by Tusk intelligence."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#f6f8f4", color: "#172018" }}>
        {children}
      </body>
    </html>
  );
}
