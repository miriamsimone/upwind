import { useEffect, useMemo, useState } from 'react';
import type {
  FlightBooking,
  RescheduleOption,
  Student,
  WeatherData,
} from '../types';
import {
  fetchCurrentWeather,
  fetchWeatherForecast,
} from '../services/weatherService';
import { generateRescheduleSuggestions } from '../services/claudeService';

interface ConflictDetailProps {
  student: Student;
  booking: FlightBooking;
  onClose: () => void;
  onReschedule: (bookingId: string, newDateTime: string) => void;
}

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

const trainingMinimums: Record<Student['trainingLevel'], string> = {
  'student-pilot':
    'Requires VFR: visibility ≥ 5 sm, winds < 15 kts, and bases above 3,000 ft',
  'private-pilot':
    'Prefers VFR or light MVFR: visibility ≥ 3 sm, manageable winds (< 20 kts)',
  'instrument-rated':
    'Capable of IFR but must maintain instructor-approved wind and ceiling limits',
};

const ConflictDetail = ({
  student,
  booking,
  onClose,
  onReschedule,
}: ConflictDetailProps) => {
  const [currentDate] = useState(() => new Date());
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherData[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<RescheduleOption[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const location = booking.departureLocation;

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError(null);

        const [current, upcoming] = await Promise.all([
          fetchCurrentWeather(location.lat, location.lon),
          fetchWeatherForecast(location.lat, location.lon, 7),
        ]);

        if (!cancelled) {
          setCurrentWeather(current);
          setForecast(upcoming);
        }
      } catch (error) {
        if (!cancelled) {
          setWeatherError(
            error instanceof Error
              ? error.message
              : 'Unable to load weather data',
          );
        }
      } finally {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      }
    };

    void loadWeather();

    return () => {
      cancelled = true;
    };
  }, [location.lat, location.lon]);

  const conflictReason = useMemo(() => {
    if (!currentWeather) {
      return 'Weather conditions exceed the student’s minimums for safe flight.';
    }

    const summaryParts = [
      `${currentWeather.conditions} conditions`,
      `visibility ${currentWeather.visibility}`,
      `winds ${currentWeather.winds}`,
    ];

    return `Forecast shows ${summaryParts.join(
      ', ',
    )}, which violates ${student.trainingLevel.replace('-', ' ')} minimums.`;
  }, [currentWeather, student.trainingLevel]);

  useEffect(() => {
    if (forecast.length === 0) {
      return;
    }

    let cancelled = false;

    const loadSuggestions = async () => {
      try {
        setSuggestionsLoading(true);
        setSuggestionsError(null);

        const result = await generateRescheduleSuggestions({
          student,
          conflictedBooking: booking,
          conflictReason,
          weatherForecast: forecast,
          currentDate,
        });

        if (!cancelled) {
          setSuggestions(result);
          setExpandedIndex(result.length > 0 ? 0 : null);
        }
      } catch (error) {
        if (!cancelled) {
          setSuggestionsError(
            error instanceof Error
              ? error.message
              : 'Unable to generate rescheduling suggestions',
          );
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false);
        }
      }
    };

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [forecast, student, booking, conflictReason, currentDate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm">
      <div className="relative flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-8 py-6">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">
              Weather Conflict
            </p>
            <h2 className="text-2xl font-semibold text-slate-900">
              {student.name} &mdash; {formatDateTime(booking.scheduledDate)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-300"
          >
            Close
          </button>
        </div>

        <div className="grid flex-1 gap-8 overflow-y-auto px-8 py-8 lg:grid-cols-[1.1fr_1fr]">
          <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Conflict Information
            </h3>

            <div className="space-y-4 text-sm text-slate-600">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Original Booking
                </p>
                <p className="mt-1 text-base font-medium text-slate-900">
                  {formatDateTime(booking.scheduledDate)}
                </p>
                <p>
                  Aircraft:{' '}
                  <span className="font-medium text-slate-900">
                    {booking.aircraft}
                  </span>
                </p>
                <p>
                  Instructor:{' '}
                  <span className="font-medium text-slate-900">
                    {booking.instructor}
                  </span>
                </p>
                <p>
                  Departure:{' '}
                  <span className="font-medium text-slate-900">
                    {location.name}
                  </span>
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Forecast at Lesson Time
                </p>
                {weatherLoading ? (
                  <p className="mt-2 text-slate-500">Loading weather data...</p>
                ) : weatherError ? (
                  <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-600">
                    {weatherError}
                  </p>
                ) : currentWeather ? (
                  <ul className="mt-2 space-y-1 text-slate-600">
                    <li>
                      Conditions:{' '}
                      <span className="font-medium text-slate-900">
                        {currentWeather.conditions}
                      </span>
                    </li>
                    <li>Winds: {currentWeather.winds}</li>
                    <li>Visibility: {currentWeather.visibility}</li>
                    <li>Sky: {currentWeather.sky}</li>
                    <li>
                      Observed:{' '}
                      {formatDateTime(new Date(currentWeather.timestamp))}
                    </li>
                  </ul>
                ) : (
                  <p className="mt-2 text-slate-500">
                    Weather data unavailable.
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p className="font-semibold text-rose-800">
                  Why it&apos;s unsafe
                </p>
                <p className="mt-1">{conflictReason}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Student Minimums
                </p>
                <p className="mt-2 text-slate-600">
                  Training level:{' '}
                  <span className="font-medium text-slate-900">
                    {student.trainingLevel.replace('-', ' ')}
                  </span>
                </p>
                <p className="text-slate-600">
                  Required minimums:{' '}
                  <span className="font-medium text-slate-900">
                    {trainingMinimums[student.trainingLevel]}
                  </span>
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                AI Rescheduling Options
              </h3>
              {suggestionsLoading && (
                <span className="text-xs font-medium uppercase tracking-wide text-sky-600">
                  Generating...
                </span>
              )}
            </div>

            {suggestionsError ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {suggestionsError}
              </p>
            ) : suggestionsLoading && suggestions.length === 0 ? (
              <div className="space-y-3">
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-4">
                {suggestions.map((option, index) => {
                  const isExpanded = expandedIndex === index;
                  return (
                    <div
                      key={`${option.dateTime}-${index}`}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedIndex(isExpanded ? null : index)
                        }
                        aria-expanded={isExpanded}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-300"
                      >
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {formatDateTime(new Date(option.dateTime))}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                            {option.conditions.sky} • {option.conditions.visibility} •{' '}
                            {option.conditions.winds}
                          </p>
                        </div>
                        <svg
                          className={`h-5 w-5 text-slate-500 transition ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            d="M6 8l4 4 4-4"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="space-y-4 border-t border-slate-200 bg-white px-5 py-5 text-sm text-slate-700">
                          <p>{option.reasoning}</p>
                          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                            <p>
                              <span className="font-medium text-slate-800">
                                Conditions:
                              </span>{' '}
                              {option.conditions.sky}
                            </p>
                            <p>
                              <span className="font-medium text-slate-800">
                                Visibility:
                              </span>{' '}
                              {option.conditions.visibility}
                            </p>
                            <p>
                              <span className="font-medium text-slate-800">
                                Winds:
                              </span>{' '}
                              {option.conditions.winds}
                            </p>
                            {option.conditions.temperature && (
                              <p>
                                <span className="font-medium text-slate-800">
                                  Temperature:
                                </span>{' '}
                                {option.conditions.temperature}
                              </p>
                            )}
                          </div>
                          {option.tradeoffs && (
                            <p className="text-xs text-slate-600">
                              <span className="font-medium text-slate-800">
                                Tradeoffs:
                              </span>{' '}
                              {option.tradeoffs}
                            </p>
                          )}
                          {option.benefits && (
                            <p className="text-xs text-slate-600">
                              <span className="font-medium text-slate-800">
                                Benefits:
                              </span>{' '}
                              {option.benefits}
                            </p>
                          )}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => onReschedule(booking.id, option.dateTime)}
                              className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                            >
                              Reschedule to This Time
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No suggestions available yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ConflictDetail;

