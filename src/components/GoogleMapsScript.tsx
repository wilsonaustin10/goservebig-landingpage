'use client';

import React from 'react';
import Script from 'next/script';

export default function GoogleMapsScript() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Log the API key status (but not the key itself) for debugging
  React.useEffect(() => {
    console.log('Google Maps API Key status:', {
      exists: !!apiKey,
      length: apiKey?.length || 0
    });
  }, [apiKey]);

  if (!apiKey) {
    console.error('Google Maps API key is not configured');
    return null;
  }

  return (
    <Script
      id="google-maps-script"
      strategy="beforeInteractive"
      src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`}
      onError={(e) => {
        console.error('Error loading Google Maps script:', e);
      }}
      onLoad={() => {
        console.log('Google Maps script loaded successfully');
      }}
    />
  );
}