// NOTE: Demo only - production would proxy through backend

import type {
  FlightBooking,
  RescheduleOption,
  Student,
  WeatherData,
} from '../types';

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

interface RescheduleContext {
  student: Student;
  conflictedBooking: FlightBooking;
  conflictReason: string;
  weatherForecast: WeatherData[];
  currentDate: Date;
}

export const generateRescheduleSuggestions = async (
  context: RescheduleContext,
): Promise<RescheduleOption[]> => {
  try {
    const { student, conflictedBooking, conflictReason, weatherForecast, currentDate } =
      context;

    const payload = {
      student,
      weather: weatherForecast[0] ?? null,
      conflict: {
        scheduledDate: conflictedBooking.scheduledDate.toISOString(),
        reason: conflictReason,
        notes: `Generated on ${currentDate.toISOString()}`,
      },
    };

    const response = await fetch(`${API_BASE}/api/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }

    const data = (await response.json()) as { suggestions?: RescheduleOption[] };
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch (error) {
    console.error('Failed to generate reschedule suggestions', error);
    return [];
  }
};

