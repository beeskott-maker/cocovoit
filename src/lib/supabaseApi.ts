import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { ApiError, type Api, type JoinResult, type TripPreview, type TripState } from './types';

function toApiError(error: PostgrestError): ApiError {
  switch (error.code) {
    case '28000':
      return new ApiError(error.message, 'forbidden');
    case 'P0002':
      return new ApiError(error.message, 'not_found');
    case '22023':
    case '23514':
      return new ApiError(error.message, 'invalid');
    default:
      return new ApiError('Une erreur est survenue, réessayez.', 'unknown');
  }
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw toApiError(error);
    return data as T;
  }

  return {
    mode: 'supabase',
    createTrip: (t) =>
      rpc('create_trip', {
        p_name: t.name,
        p_destination: t.destination,
        p_starts_on: t.startsOn,
        p_ends_on: t.endsOn,
        p_organizer_name: t.organizerName,
        p_organizer_email: t.organizerEmail,
      }),
    getTripPreview: (code) => rpc<TripPreview | null>('get_trip_preview', { p_code: code }),
    joinTrip: (code, email, name) =>
      rpc<JoinResult>('join_trip', { p_code: code, p_email: email, p_name: name ?? null }),
    getTripState: (code, secret) => rpc<TripState>('get_trip_state', { p_code: code, p_secret: secret }),
    saveCar: (code, secret, input) =>
      rpc<string>('save_car', {
        p_code: code,
        p_secret: secret,
        p_car_id: input.carId,
        p_seats: input.seats,
        p_legs: input.legs,
      }),
    deleteCar: (code, secret, carId) =>
      rpc('delete_car', { p_code: code, p_secret: secret, p_car_id: carId }),
    takeSeat: (code, secret, legId) =>
      rpc('take_seat', { p_code: code, p_secret: secret, p_leg_id: legId }),
    leaveSeat: (code, secret, legId) =>
      rpc('leave_seat', { p_code: code, p_secret: secret, p_leg_id: legId }),
  };
}
