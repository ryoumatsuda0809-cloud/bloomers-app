export interface Facility {
  id: string;
  name: string;
  lat: number;
  lng: number;
  client_name: string;
  radius: number;
  address: string | null;
}
