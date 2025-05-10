'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { FormProvider } from '../context/FormContext';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Script from 'next/script';
import { useEffect } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Debug environment variables
    console.log('Environment check:', {
      hasGoogleKey: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      keyLength: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.length || 0,
    });
  }, []);

  return (
    <html lang="en">
      <head>
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="beforeInteractive"
          onLoad={() => {
            console.log('Google Maps script loaded successfully');
            console.log('API Key check:', {
              exists: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
              length: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.length || 0
            });
          }}
          onError={(e) => {
            console.error('Error loading Google Maps script:', e);
            console.error('API Key status:', {
              exists: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
              length: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.length || 0
            });
          }}
        />
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=AW-17041108639"
        />
        <Script
          id="gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-17041108639');
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <FormProvider>
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </FormProvider>
      </body>
    </html>
  );
} 