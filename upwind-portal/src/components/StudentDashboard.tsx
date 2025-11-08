import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { bookings, students } from '../data/mockData';
import { fetchCurrentWeather, fetchWeatherForecast } from '../services/weatherService';
import type { FlightBooking, Student, WeatherData } from '../types';
import TrainingStatusCard from './TrainingStatusCard';
import ConflictDetail from './ConflictDetail';

const statusColorMap: Record<FlightBooking['status'], string> = {
  scheduled: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  'weather-conflict': 'bg-rose-500 text-white ring-rose-500',
  rescheduled: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

const findStudent = (studentId: string): Student | undefined =>
  students.find((s) => s.id === studentId);

const upcomingLessons = (studentId: string): FlightBooking[] =>
  bookings
    .filter((booking) => booking.studentId === studentId)
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

const DEFAULT_COORDS = {
  lat: 44.827,
  lon: -93.457,
  name: 'Flying Cloud Airport (FCM)',
};

const LOCATION_KEY = (location: FlightBooking['departureLocation']) =>
  `${location.lat},${location.lon}`;

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const differenceInDays = (from: Date, to: Date) => {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((toUtc - fromUtc) / MS_PER_DAY);
};

const parseVisibilityMiles = (value: string): number | undefined => {
  const match = value.match(/([\d.]+)/);
  return match ? Number.parseFloat(match[1]) : undefined;
};

const parseWindSpeedKts = (value: string): number | undefined => {
  if (/calm/i.test(value)) {
    return 0;
  }
  const match = value.match(/([\d.]+)\s*kts/i);
  return match ? Number.parseFloat(match[1]) : undefined;
};

const trainingMinimumRules: Record<
  Student['trainingLevel'],
  { minVisibility: number; maxWind: number; allowedConditions: Array<WeatherData['conditions']> }
> = {
  'student-pilot': {
    minVisibility: 5,
    maxWind: 15,
    allowedConditions: ['VFR'],
  },
  'private-pilot': {
    minVisibility: 3,
    maxWind: 20,
    allowedConditions: ['VFR', 'MVFR'],
  },
  'instrument-rated': {
    minVisibility: 1,
    maxWind: 25,
    allowedConditions: ['VFR', 'MVFR', 'IFR'],
  },
};

const meetsStudentMinimums = (student: Student, weather: WeatherData) => {
  const rules = trainingMinimumRules[student.trainingLevel];
  const visibility = parseVisibilityMiles(weather.visibility);
  const windSpeed = parseWindSpeedKts(weather.winds);

  const visibilityOk = visibility == null || visibility >= rules.minVisibility;
  const windOk = windSpeed == null || windSpeed <= rules.maxWind;
  const conditionsOk = rules.allowedConditions.includes(weather.conditions);

  return visibilityOk && windOk && conditionsOk;
};

const StudentDashboard = () => {
  const { studentId = 's1' } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherData[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<FlightBooking | null>(null);
  const [lessonState, setLessonState] = useState<FlightBooking[]>([]);
  const [highlightedConflictId, setHighlightedConflictId] = useState<string | null>(
    null,
  );
  const conflictRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!findStudent(studentId)) {
      navigate('/dashboard/s1', { replace: true });
    }
  }, [studentId, navigate]);

  useEffect(() => {
    setLessonState(upcomingLessons(studentId));
  }, [studentId]);

  const lessons = lessonState;

const lessonSignature = useMemo(
  () =>
    lessons
      .map(
        (lesson) =>
          `${lesson.id}-${lesson.scheduledDate.toISOString()}-${lesson.status}`,
      )
      .join('|'),
  [lessons],
);

  const firstConflictId = useMemo(() => {
    const conflictLesson = lessons.find((lesson) => lesson.status === 'weather-conflict');
    return conflictLesson?.id ?? null;
  }, [lessons]);

  useEffect(() => {
    if (firstConflictId && conflictRef.current) {
      conflictRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (firstConflictId) {
      setHighlightedConflictId(firstConflictId);
      const timeout = window.setTimeout(() => setHighlightedConflictId(null), 4000);
      return () => window.clearTimeout(timeout);
    }
    setHighlightedConflictId(null);
    return undefined;
  }, [firstConflictId]);

  const primaryLocation = useMemo(() => {
    const lessonLocation = lessons[0]?.departureLocation;

    if (lessonLocation) {
      return {
        lat: lessonLocation.lat,
        lon: lessonLocation.lon,
        name: lessonLocation.name,
      };
    }

    return DEFAULT_COORDS;
  }, [lessons]);

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError(null);

        const [current, upcoming] = await Promise.all([
          fetchCurrentWeather(primaryLocation.lat, primaryLocation.lon),
          fetchWeatherForecast(primaryLocation.lat, primaryLocation.lon, 7),
        ]);

        if (!cancelled) {
          setWeather(current);
          setForecast(upcoming);
        }
      } catch (error) {
        if (!cancelled) {
          setWeatherError(
            error instanceof Error ? error.message : 'Unable to load weather data',
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
  }, [primaryLocation.lat, primaryLocation.lon]);

  const student = findStudent(studentId);

useEffect(() => {
  if (!student || lessons.length === 0) {
    return;
  }

  const now = new Date();
  const relevantLessons = lessons.filter((lesson) => {
    if (lesson.status === 'rescheduled') {
      return false;
    }
    const diffDays = differenceInDays(now, lesson.scheduledDate);
    return diffDays >= 0 && diffDays < 7;
  });

  if (relevantLessons.length === 0) {
    setLessonState((prev) => {
      let changed = false;
      const next = prev.map((lesson) => {
        if (lesson.status === 'rescheduled') {
          return lesson;
        }
        if (lesson.status !== 'scheduled') {
          changed = true;
          return { ...lesson, status: 'scheduled' };
        }
        return lesson;
      });
      return changed ? next : prev;
    });
    return;
  }

  let cancelled = false;

  const uniqueLocations = Array.from(
    new Map(
      relevantLessons.map((lesson) => [
        LOCATION_KEY(lesson.departureLocation),
        lesson.departureLocation,
      ]),
    ).values(),
  );

  const evaluateConflicts = async () => {
    try {
      const forecastEntries = await Promise.all(
        uniqueLocations.map(async (location) => {
          const daily = await fetchWeatherForecast(location.lat, location.lon, 7);
          return [LOCATION_KEY(location), daily] as const;
        }),
      );

      if (cancelled) {
        return;
      }

      const forecastMap = new Map<string, WeatherData[]>(forecastEntries);
      const today = new Date();

      setLessonState((prev) => {
        let changed = false;
        const next = prev.map((lesson) => {
          if (lesson.status === 'rescheduled') {
            return lesson;
          }

          const diffDays = differenceInDays(today, lesson.scheduledDate);
          if (diffDays < 0 || diffDays >= 7) {
            if (lesson.status !== 'scheduled') {
              changed = true;
              return { ...lesson, status: 'scheduled' };
            }
            return lesson;
          }

          const locationKey = LOCATION_KEY(lesson.departureLocation);
          const dailyForecast = forecastMap.get(locationKey) ?? [];
          const targetDateKey = getDateKey(lesson.scheduledDate);
          const forecastForDay =
            dailyForecast.find(
              (entry) => getDateKey(entry.timestamp) === targetDateKey,
            ) ?? null;

          const nextStatus =
            forecastForDay && !meetsStudentMinimums(student, forecastForDay)
              ? 'weather-conflict'
              : 'scheduled';

          if (lesson.status !== nextStatus) {
            changed = true;
            return { ...lesson, status: nextStatus };
          }
          return lesson;
        });

        return changed ? next : prev;
      });
    } catch (error) {
      console.error('Failed to evaluate weather conflicts', error);
    }
  };

  evaluateConflicts();

  return () => {
    cancelled = true;
  };
}, [student, studentId, lessonSignature, lessons]);

  if (!student) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        No student data found. Please verify the student selection.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-white">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-3xl font-semibold tracking-tight text-sky-900">
              Upwind
            </span>
            <p className="text-sm text-slate-500">Flight Training Portal</p>
          </div>
          <div className="rounded-full bg-sky-50 px-5 py-2 text-right shadow-sm ring-1 ring-sky-100">
            <p className="text-sm font-medium text-slate-500">Current Student</p>
            <p className="text-lg font-semibold text-sky-900">{student.name}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-8">
            <TrainingStatusCard student={student} />

            <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-500 to-sky-600 p-8 text-white shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Weather Brief</h2>
                <span className="text-sm text-sky-100">{primaryLocation.name}</span>
              </div>

              {weatherLoading ? (
                <p className="mt-6 text-sm text-sky-100">Loading latest weather...</p>
              ) : weatherError ? (
                <p className="mt-6 rounded-lg bg-rose-500/20 px-4 py-3 text-sm text-rose-100">
                  {weatherError}
                </p>
              ) : weather ? (
                <>
                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-sm uppercase tracking-wide text-sky-100">
                        Temperature
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {weather.temperature}°F
                      </p>
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-wide text-sky-100">
                        Conditions
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {weather.conditions}
                      </p>
                      <p className="text-sm text-sky-100">{weather.sky}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 text-sm text-sky-100">
                    <p>
                      <span className="font-medium text-white">Visibility:</span>{' '}
                      {weather.visibility}
                    </p>
                    <p>
                      <span className="font-medium text-white">Winds:</span>{' '}
                      {weather.winds}
                    </p>
                    <p>
                      <span className="font-medium text-white">Updated:</span>{' '}
                      {formatDate(weather.timestamp)}
                    </p>
                  </div>

                  {forecast.length > 0 && (
                    <div className="mt-8 space-y-3">
                      <p className="text-sm uppercase tracking-wide text-sky-100">
                        7-Day Outlook
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {forecast.map((day) => (
                          <div
                            key={day.timestamp.toISOString()}
                            className="rounded-xl bg-white/10 px-4 py-3 text-sm text-sky-100"
                          >
                            <p className="font-medium text-white">
                              {formatDate(day.timestamp)}
                            </p>
                            <p>Temp: {day.temperature}°F</p>
                            <p>Visibility: {day.visibility}</p>
                            <p>Winds: {day.winds}</p>
                            <p>Conditions: {day.conditions}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-6 text-sm text-sky-100">
                  Weather data unavailable for this location.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-sky-900">
                Upcoming Lessons
              </h2>
              <span className="rounded-full bg-sky-50 px-4 py-1 text-sm font-medium text-sky-700">
                {lessons.length} scheduled
              </span>
            </div>
            <ul className="space-y-4">
              {lessons.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                  No upcoming lessons scheduled.
                </li>
              ) : (
                lessons.map((lesson) => {
                  const isConflict = lesson.status === 'weather-conflict';

                  return (
                    <li
                      key={lesson.id}
                      ref={firstConflictId === lesson.id ? conflictRef : null}
                      className={`group rounded-xl border px-5 py-5 shadow-sm transition ring-1 ${
                        highlightedConflictId === lesson.id
                          ? 'ring-rose-300 animate-pulse'
                          : 'ring-transparent'
                      } ${
                        isConflict
                          ? 'cursor-pointer border-rose-200 bg-rose-50 hover:-translate-y-1 hover:shadow-lg hover:ring-rose-200'
                          : 'border-slate-100 bg-white hover:-translate-y-0.5 hover:shadow-md hover:ring-sky-100'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">
                            {lesson.aircraft}
                          </p>
                          <p className="text-sm text-slate-500">
                            {formatDate(lesson.scheduledDate)}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            Instructor:{' '}
                            <span className="font-medium text-slate-800">
                              {lesson.instructor}
                            </span>
                          </p>
                          <p className="text-sm text-slate-600">
                            Departure:{' '}
                            <span className="font-medium text-slate-800">
                              {lesson.departureLocation.name}
                            </span>
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-semibold shadow-sm ring-1 ${statusColorMap[lesson.status]}`}
                        >
                          {lesson.status.replace('-', ' ')}
                        </span>
                      </div>

                      {isConflict && (
                        <button
                          type="button"
                          onClick={() => setSelectedConflict(lesson)}
                          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400"
                        >
                          View Rescheduling Options &rarr;
                        </button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </section>
      </main>
      {selectedConflict && (
        <ConflictDetail
          student={student}
          booking={selectedConflict}
          onClose={() => setSelectedConflict(null)}
          onReschedule={(bookingId, newDateTime) => {
            setLessonState((prev) => {
              const updated = prev
                .map((item) =>
                  item.id === bookingId
                    ? {
                        ...item,
                        status: 'rescheduled',
                        scheduledDate: new Date(newDateTime),
                      }
                    : item,
                )
                .sort(
                  (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime(),
                );
              return updated;
            });
            setSelectedConflict(null);
            window.alert(
              `Lesson rescheduled to ${formatDate(new Date(newDateTime))}`,
            );
          }}
        />
      )}
    </div>
  );
};

export default StudentDashboard;

