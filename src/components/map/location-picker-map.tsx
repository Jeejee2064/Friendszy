"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const QUEBEC_CENTER: [number, number] = [-71.5, 52];
const QUEBEC_ZOOM = 4.5;
const LOCATED_ZOOM = 13;

type Coordinates = { latitude: number; longitude: number };

// Shared by every "drop a pin" creation flow (partner listings, events, ...):
// typing a city/address geocodes and centers the map, then the user can drag
// the marker to the exact spot. Caller owns the copy (hintText/locatingText)
// so this stays feature-agnostic.
export function LocationPickerMap({
  city,
  address,
  value,
  onChange,
  hintText,
  locatingText,
}: {
  city: string;
  address: string;
  value: { latitude: number | null; longitude: number | null };
  onChange: (coords: Coordinates) => void;
  hintText: string;
  locatingText: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  // Tracks which city/address the map was last geocoded for, so we don't
  // re-geocode on every keystroke re-render — only on an actual change.
  const geocodedFromRef = useRef({ city: "", address: "" });
  const [locating, setLocating] = useState(false);

  function placeMarker(lng: number, lat: number, notify: (coords: Coordinates) => void) {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      const marker = new mapboxgl.Marker({ draggable: true }).setLngLat([lng, lat]).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLngLat();
        notify({ latitude: pos.lat, longitude: pos.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
  }

  // Initialize the map once. Reads `value`/`onChange` only at mount time —
  // subsequent coordinate changes are handled imperatively via the other
  // effect and the marker's own drag/click handlers, not by re-running this.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const hasInitialCoords = value.latitude != null && value.longitude != null;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: hasInitialCoords ? [value.longitude!, value.latitude!] : QUEBEC_CENTER,
      zoom: hasInitialCoords ? LOCATED_ZOOM : QUEBEC_ZOOM,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    if (hasInitialCoords) {
      placeMarker(value.longitude!, value.latitude!, onChange);
      geocodedFromRef.current = { city, address };
    }

    map.on("click", (e) => {
      onChange({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
      placeMarker(e.lngLat.lng, e.lngLat.lat, onChange);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-geocode (debounced) whenever city/address actually change.
  useEffect(() => {
    const trimmedCity = city.trim();
    const trimmedAddress = address.trim();
    if (!trimmedCity) return;
    if (
      trimmedCity === geocodedFromRef.current.city &&
      trimmedAddress === geocodedFromRef.current.address
    ) {
      return;
    }

    const timeout = setTimeout(async () => {
      geocodedFromRef.current = { city: trimmedCity, address: trimmedAddress };
      setLocating(true);
      try {
        const response = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: trimmedCity, address: trimmedAddress || undefined }),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data.latitude === "number" && typeof data.longitude === "number") {
          onChange({ latitude: data.latitude, longitude: data.longitude });
          mapRef.current?.flyTo({ center: [data.longitude, data.latitude], zoom: LOCATED_ZOOM });
          placeMarker(data.longitude, data.latitude, onChange);
        }
      } finally {
        setLocating(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, address]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-lg border border-border"
      />
      <p className="text-xs text-muted">{locating ? locatingText : hintText}</p>
    </div>
  );
}
