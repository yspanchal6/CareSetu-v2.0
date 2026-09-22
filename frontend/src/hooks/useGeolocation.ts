import { useState, useCallback } from 'react';

// Location shape matching backend SOS schema requirement
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: 'GPS' | 'MANUAL' | 'NETWORK' | 'CACHED';
}

interface GeolocationState {
  loading: boolean;
  error: string | null;
  location: LocationData | null;
}

export const useGeolocation = () => {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    location: null,
  });

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        loading: false,
        error: 'Geolocation is not supported by your browser.',
        location: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          loading: false,
          error: null,
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: 'GPS',
          },
        });
      },
      (error) => {
        let errorMessage = 'An unknown error occurred while fetching location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access was denied. Please enable permissions to send SOS.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'The request to get user location timed out. Ensure your GPS is enabled.';
            break;
        }

        setState({
          loading: false,
          error: errorMessage,
          location: null,
        });
      },
      {
        // Force GPS hardware for high accuracy, essential for emergencies
        enableHighAccuracy: true,
        // Wait at most 10 seconds for the hardware to lock on
        timeout: 10000,
        // Accept cached location if it is less than 30 seconds old
        maximumAge: 30000,
      }
    );
  }, []);

  return { ...state, fetchLocation };
};
