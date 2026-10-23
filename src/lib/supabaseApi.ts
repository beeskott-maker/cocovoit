import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { ApiError, type Account, type AdminTrip, type Api, type LoginResult, type MyTrip, type TripPreview, type TripState } from './types';

function toApiError(error: PostgrestError): ApiError {
  switch (error.code) {
    case '28P01':
      return new ApiError(error.message, 'unauthenticated');
    case '28000':
      return new ApiError(error.message, 'forbidden');
    case '42501':
      return new ApiError(error.message, 'unauthorized_email');
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
    login: (email, name) => rpc<LoginResult>('login', { p_email: email, p_name: name ?? null }),
    me: (token) => rpc<Account>('me', { p_token: token }),
    logout: (token) => rpc('logout', { p_token: token }),
    createTrip: (token, t) =>
      rpc<string>('create_trip', {
        p_token: token,
        p_name: t.name,
        p_destination: t.destination,
        p_starts_on: t.startsOn,
        p_ends_on: t.endsOn,
      }),
    getTripPreview: (code) => rpc<TripPreview | null>('get_trip_preview', { p_code: code }),
    joinTrip: (token, code) => rpc('join_trip', { p_token: token, p_code: code }),
    myTrips: (token) => rpc<MyTrip[]>('my_trips', { p_token: token }),
    getTripState: (token, code) => rpc<TripState>('get_trip_state', { p_token: token, p_code: code }),
    saveCar: (token, code, input) =>
      rpc<string>('save_car', {
        p_token: token,
        p_code: code,
        p_car_id: input.carId,
        p_seats: input.seats,
        p_legs: input.legs,
      }),
    deleteCar: (token, code, carId) => rpc('delete_car', { p_token: token, p_code: code, p_car_id: carId }),
    takeSeat: (token, code, legId) => rpc('take_seat', { p_token: token, p_code: code, p_leg_id: legId }),
    leaveSeat: (token, code, legId) => rpc('leave_seat', { p_token: token, p_code: code, p_leg_id: legId }),
    adminListTrips: (key, email) => rpc<AdminTrip[]>('admin_list_trips', { p_key: key, p_email: email }),
    adminDeleteTrip: (key, email, code) =>
      rpc('admin_delete_trip', { p_key: key, p_email: email, p_code: code }),
  };
}
