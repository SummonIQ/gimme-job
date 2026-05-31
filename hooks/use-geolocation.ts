'use client';

import { useCallback, useEffect, useState } from 'react';

interface GeolocationState {
  location: string | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean | null;
}

interface GeolocationResult {
  city: string;
  state: string;
  country: string;
  formattedAddress: string;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    isLoading: false,
    error: null,
    hasPermission: null,
  });

  // Check permission status on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.permissions) return;

    navigator.permissions
      .query({ name: 'geolocation' })
      .then(permissionStatus => {
        setState(prev => ({
          ...prev,
          hasPermission: permissionStatus.state === 'granted',
        }));

        // Check localStorage for cached location
        const cached = localStorage.getItem('user_location');
        if (cached && permissionStatus.state === 'granted') {
          setState(prev => ({
            ...prev,
            location: cached,
          }));
        }

        // Listen for permission changes
        permissionStatus.addEventListener('change', () => {
          setState(prev => ({
            ...prev,
            hasPermission: permissionStatus.state === 'granted',
          }));

          // Clear cached location if permission denied
          if (permissionStatus.state === 'denied') {
            localStorage.removeItem('user_location');
            document.cookie = 'user_location=; path=/; max-age=0';
            setState(prev => ({
              ...prev,
              location: null,
            }));
          }
        });
      })
      .catch(() => {
        // Permissions API not supported, will rely on geolocation API directly
        setState(prev => ({
          ...prev,
          hasPermission: null,
        }));
      });
  }, []);

  const reverseGeocode = async (
    latitude: number,
    longitude: number,
  ): Promise<GeolocationResult | null> => {
    try {
      // Use Nominatim for reverse geocoding (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?` +
          `lat=${latitude}&lon=${longitude}&format=json`,
        {
          headers: {
            'User-Agent': 'GimmeJob/1.0',
          },
        },
      );

      if (!response.ok) throw new Error('Geocoding failed');

      const data = await response.json();
      const address = data.address || {};

      const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        '';
      const state = address.state || '';
      const country = address.country || '';

      return {
        city,
        state,
        country,
        formattedAddress: city && state ? `${city}, ${state}` : city || state,
      };
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return null;
    }
  };

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
        hasPermission: false,
      }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    return new Promise<string | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async position => {
          try {
            const { latitude, longitude } = position.coords;
            const result = await reverseGeocode(latitude, longitude);

            if (result && result.formattedAddress) {
              // Cache the location in localStorage and cookie
              localStorage.setItem('user_location', result.formattedAddress);
              // Set cookie with 30 days expiry
              document.cookie = `user_location=${encodeURIComponent(result.formattedAddress)}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;

              setState(prev => ({
                ...prev,
                location: result.formattedAddress,
                isLoading: false,
                hasPermission: true,
                error: null,
              }));

              resolve(result.formattedAddress);
            } else {
              setState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Unable to determine your location',
              }));
              resolve(null);
            }
          } catch (error) {
            console.error('Error processing location:', error);
            setState(prev => ({
              ...prev,
              isLoading: false,
              error: 'Failed to process location data',
            }));
            resolve(null);
          }
        },
        error => {
          let errorMessage = 'Failed to get your location';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                'Location access denied. Please enable location permissions in your browser.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }

          setState(prev => ({
            ...prev,
            isLoading: false,
            error: errorMessage,
            hasPermission: error.code === error.PERMISSION_DENIED ? false : prev.hasPermission,
          }));

          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // Cache for 5 minutes
        },
      );
    });
  }, []);

  const clearLocation = useCallback(() => {
    localStorage.removeItem('user_location');
    // Clear the cookie
    document.cookie = 'user_location=; path=/; max-age=0';
    setState(prev => ({
      ...prev,
      location: null,
    }));
  }, []);

  return {
    location: state.location,
    isLoading: state.isLoading,
    error: state.error,
    hasPermission: state.hasPermission,
    requestLocation,
    clearLocation,
  };
}
