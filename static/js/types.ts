import L from 'leaflet';

export interface Pin {
    id: string;
    name: string;
    lat: number;
    lng: number;
    imageUrl?: string;
    location?: string;
    connections?: Connection[];
}

export interface Connection {
    id: string;
    sourceId: string;
    targetId: string;
    timestamp: string;
}

export interface MarkerWithData extends L.Marker {
    pinId: string;
    pinData: Pin;
    labelMarker?: L.Marker;  // Optional label marker associated with this marker
}

export interface Activity {
    id: string;
    type: 'pin_created' | 'pin_deleted' | 'connection_created' | 'connection_deleted';
    timestamp: string;
    data: {
        pin?: Pin;
        connection?: Connection;
    };
}

export interface MapConfig {
    center: L.LatLng;
    zoom: number;
    maxZoom: number;
    minZoom: number;
}

export interface ApiResponse<T> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
}

export interface PinsResponse extends ApiResponse<never> {
    pins: Pin[];
}

export interface ConnectionsResponse extends ApiResponse<never> {
    connections: Connection[];
}

export interface SinglePinResponse extends ApiResponse<never> {
    pin: Pin;
}

export interface SingleConnectionResponse extends ApiResponse<never> {
    connection: Connection;
}
