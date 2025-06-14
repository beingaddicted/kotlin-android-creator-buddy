
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Member {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lastSeen: string;
  status: 'active' | 'offline';
}

interface MapViewProps {
  members: Member[];
  selectedMember?: string;
  onMemberSelect: (memberId: string) => void;
}

export const MapView = ({ members, selectedMember, onMemberSelect }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>("");
  const [tokenEntered, setTokenEntered] = useState(false);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});

  const initializeMap = () => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [0, 0],
      zoom: 2,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    map.current.on('load', () => {
      updateMarkers();
    });
  };

  const updateMarkers = () => {
    if (!map.current) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    if (members.length === 0) return;

    // Add markers for each member
    members.forEach(member => {
      const el = document.createElement('div');
      el.className = `w-8 h-8 rounded-full border-2 cursor-pointer transition-all ${
        member.status === 'active' ? 'bg-green-500 border-green-600' : 'bg-gray-400 border-gray-500'
      } ${selectedMember === member.id ? 'ring-4 ring-blue-300 scale-125' : ''}`;
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([member.longitude, member.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div class="p-2">
            <h3 class="font-semibold">${member.name}</h3>
            <p class="text-sm text-gray-600">Status: ${member.status}</p>
            <p class="text-sm text-gray-600">Last seen: ${member.lastSeen}</p>
          </div>
        `))
        .addTo(map.current!);

      el.addEventListener('click', () => {
        onMemberSelect(member.id);
      });

      markersRef.current[member.id] = marker;
    });

    // Fit map to show all markers
    if (members.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      members.forEach(member => {
        bounds.extend([member.longitude, member.latitude]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }
  };

  useEffect(() => {
    if (tokenEntered && mapboxToken) {
      initializeMap();
    }
  }, [tokenEntered, mapboxToken]);

  useEffect(() => {
    updateMarkers();
  }, [members, selectedMember]);

  useEffect(() => {
    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  if (!tokenEntered) {
    return (
      <div className="w-full h-96 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Mapbox Token Required</h3>
          <p className="text-gray-600 mb-4">
            Enter your Mapbox public token to display the map. You can get one from{' '}
            <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              mapbox.com
            </a>
          </p>
          <div className="space-y-3">
            <Input
              type="text"
              placeholder="pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ..."
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
            />
            <Button 
              onClick={() => setTokenEntered(true)}
              disabled={!mapboxToken.startsWith('pk.')}
              className="w-full"
            >
              Initialize Map
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />
      {members.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-center">
            <p className="text-lg font-semibold">No members to display</p>
            <p className="text-sm">Add members to your organization to see them on the map</p>
          </div>
        </div>
      )}
    </div>
  );
};
