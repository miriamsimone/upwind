// NOTE: In production, API keys should be proxied through a secure backend

import type { WeatherData } from '../types';

type FlightCategory = WeatherData['conditions'];

interface OpenWeatherCondition {
  description?: string;
}

interface OpenWeatherWind {
  deg?: number;
  speed?: number;
}

interface OpenWeatherMain {
  temp?: number;
}

interface OpenWeatherClouds {
  all?: number;
}

interface OpenWeatherEntry {
  dt: number;
  main?: OpenWeatherMain;
  wind?: OpenWeatherWind;
  visibility?: number;
  clouds?: OpenWeatherClouds;
  weather?: OpenWeatherCondition[];
}

type OpenWeatherCurrentResponse = OpenWeatherEntry;

interface OpenWeatherForecastResponse {
  list?: OpenWeatherEntry[];
}

const API_BASE = 'https://api.openweathermap.org/data/2.5';

const ensureApiKey = () => {
  const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenWeather API key is not configured');
  }
  return apiKey;
};

const formatWinds = (deg?: number, speedMph?: number) => {
  if (deg == null || speedMph == null) {
    return 'Calm';
  }

  const normalizedHeading = Math.round(deg);
  const knots = Math.round(speedMph * 0.868976);
  return `${normalizedHeading}° at ${knots} kts`;
};

const formatVisibility = (visibilityMeters?: number) => {
  if (visibilityMeters == null) {
    return 'N/A';
  }
  const statuteMiles = visibilityMeters / 1609.34;
  return `${statuteMiles.toFixed(1)} sm`;
};

const determineFlightCategory = (
  visibilityMeters?: number,
  cloudCoveragePercent?: number,
): FlightCategory => {
  if (visibilityMeters == null) {
    return 'VFR';
  }

  const visibilitySm = visibilityMeters / 1609.34;
  const coverage = cloudCoveragePercent ?? 0;

  if (visibilitySm < 3 || coverage >= 85) {
    return 'IFR';
  }

  if (visibilitySm < 5 || coverage >= 60) {
    return 'MVFR';
  }

  return 'VFR';
};

const buildSkySummary = (weatherDescriptions: string[]) => {
  if (weatherDescriptions.length === 0) {
    return 'Clear';
  }

  return weatherDescriptions
    .map((description) => description[0].toUpperCase() + description.slice(1))
    .join(', ');
};

const mapCurrentWeather = (payload: OpenWeatherCurrentResponse): WeatherData => {
  const descriptionList: string[] = (payload.weather ?? []).map(
    (item) => item?.description ?? 'conditions',
  );

  return {
    temperature: payload.main?.temp ?? 0,
    winds: formatWinds(payload.wind?.deg, payload.wind?.speed),
    visibility: formatVisibility(payload.visibility),
    sky: buildSkySummary(descriptionList),
    conditions: determineFlightCategory(
      payload.visibility,
      payload.clouds?.all,
    ),
    timestamp: new Date(payload.dt * 1000),
  };
};

const mapForecastEntry = (entry: OpenWeatherEntry): WeatherData => {
  const descriptionList: string[] = (entry.weather ?? []).map(
    (item) => item?.description ?? 'conditions',
  );

  return {
    temperature: entry.main?.temp ?? 0,
    winds: formatWinds(entry.wind?.deg, entry.wind?.speed),
    visibility: formatVisibility(entry.visibility),
    sky: buildSkySummary(descriptionList),
    conditions: determineFlightCategory(
      entry.visibility,
      entry.clouds?.all,
    ),
    timestamp: new Date(entry.dt * 1000),
  };
};

export const fetchCurrentWeather = async (
  lat: number,
  lon: number,
): Promise<WeatherData | null> => {
  try {
    const apiKey = ensureApiKey();
    const response = await fetch(
      `${API_BASE}/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`,
    );

    if (!response.ok) {
      throw new Error(`OpenWeather responded with ${response.status}`);
    }

    const data: OpenWeatherCurrentResponse = await response.json();
    return mapCurrentWeather(data);
  } catch (error) {
    console.error('Failed to fetch current weather', error);
    return null;
  }
};

export const fetchWeatherForecast = async (
  lat: number,
  lon: number,
  days: number,
): Promise<WeatherData[]> => {
  try {
    const apiKey = ensureApiKey();
    const response = await fetch(
      `${API_BASE}/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`,
    );

    if (!response.ok) {
      throw new Error(`OpenWeather responded with ${response.status}`);
    }

    const data: OpenWeatherForecastResponse = await response.json();
    const entries: OpenWeatherEntry[] = data.list ?? [];
    const grouped = new Map<string, OpenWeatherEntry[]>();

    for (const entry of entries) {
      const dateKey = new Date(entry.dt * 1000).toISOString().slice(0, 10);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)?.push(entry);
    }

    const maxDays = Math.min(Math.max(days, 1), 7);
    const summaries: WeatherData[] = [];

    for (const [, dayEntries] of grouped) {
      const middayEntry =
        dayEntries.find((item) => {
          const hour = new Date(item.dt * 1000).getUTCHours();
          return hour >= 15 && hour <= 21;
        }) ?? dayEntries[Math.floor(dayEntries.length / 2)];

      summaries.push(mapForecastEntry(middayEntry));

      if (summaries.length >= maxDays) {
        break;
      }
    }

    return summaries;
  } catch (error) {
    console.error('Failed to fetch weather forecast', error);
    return [];
  }
};

