import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "leaflet/dist/leaflet.css";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "MEJOR QUE DECIR, Jóvenes FR",
  description:
    "Escuchamos a los y las jóvenes del Encuentro Nacional de Jóvenes FR: su distrito, sus problemas, sus necesidades y su visión del país.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#04537a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <Script id="saved-theme" strategy="beforeInteractive">
          {`try {
            var theme = localStorage.getItem("mqd_theme");
            if (theme) document.documentElement.setAttribute("data-theme", theme);
          } catch (error) {}`}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
