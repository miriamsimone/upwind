import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;

const anthropicClient =
  anthropicApiKey != null && anthropicApiKey !== ''
    ? new Anthropic({ apiKey: anthropicApiKey })
    : null;

type FlightCategory = 'VFR' | 'MVFR' | 'IFR';

interface WeatherData {
  temperature: number;
  winds: string;
  visibility: string;
  sky: string;
  conditions: FlightCategory;
  timestamp: Date;
}

interface ReschedulePayload {
  student: unknown;
  weather: WeatherData;
  conflict: {
    scheduledDate: string;
    reason?: string;
    notes?: string;
  };
}

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
) => {
  if (visibilityMeters == null) {
    return 'VFR' as FlightCategory;
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

const mapCurrentWeather = (payload: any): WeatherData => {
  const descriptionList: string[] = (payload.weather ?? []).map(
    (item: any) => item?.description ?? 'conditions',
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

const mapForecastWeather = (payload: any[]): WeatherData[] =>
  payload.map((entry: any) => {
    const descriptionList: string[] = (entry.weather ?? []).map(
      (item: any) => item?.description ?? 'conditions',
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
  });

const fetchOpenWeather = async (url: string, params: Record<string, unknown>) => {
  if (!openWeatherApiKey) {
    throw new Error('OPENWEATHER_API_KEY is not configured');
  }

  const response = await axios.get(url, {
    params: {
      appid: openWeatherApiKey,
      units: 'imperial',
      ...params,
    },
  });

  return response.data;
};

app.get('/api/weather/current', async (req: Request, res: Response) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required query parameters' });
  }

  try {
    const data = await fetchOpenWeather('https://api.openweathermap.org/data/2.5/weather', {
      lat,
      lon,
    });

    const weather = mapCurrentWeather(data);
    return res.json(weather);
  } catch (error) {
    const message =
      axios.isAxiosError(error) && error.response
        ? error.response.data
        : (error as Error).message;
    return res.status(500).json({ error: 'Unable to fetch current weather', details: message });
  }
});

app.get('/api/weather/forecast', async (req: Request, res: Response) => {
  const { lat, lon, days = '3' } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required query parameters' });
  }

  const daysInt = Math.min(Math.max(parseInt(String(days), 10) || 3, 1), 7);
  const entriesPerDay = 8; // 3-hour increments

  try {
    const data = await fetchOpenWeather('https://api.openweathermap.org/data/2.5/forecast', {
      lat,
      lon,
      cnt: daysInt * entriesPerDay,
    });

    const grouped = new Map<string, any[]>();

    for (const entry of data.list ?? []) {
      const dateKey = new Date(entry.dt * 1000).toISOString().slice(0, 10);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)?.push(entry);
    }

    const dailySummaries: WeatherData[] = [];

    for (const [, entries] of grouped) {
      const middayEntry =
        entries.find((item) => {
          const hour = new Date(item.dt * 1000).getUTCHours();
          return hour >= 15 && hour <= 21;
        }) ?? entries[Math.floor(entries.length / 2)];

      dailySummaries.push(mapForecastWeather([middayEntry])[0]);
      if (dailySummaries.length >= daysInt) {
        break;
      }
    }

    return res.json(dailySummaries);
  } catch (error) {
    const message =
      axios.isAxiosError(error) && error.response
        ? error.response.data
        : (error as Error).message;
    return res.status(500).json({ error: 'Unable to fetch forecast weather', details: message });
  }
});

app.post('/api/reschedule', async (req: Request, res: Response) => {
  if (!anthropicClient) {
    return res.status(500).json({ error: 'Anthropic API is not configured' });
  }

  const { student, weather, conflict } = req.body as ReschedulePayload;

  if (!student || !weather || !conflict) {
    return res
      .status(400)
      .json({ error: 'student, weather, and conflict are required in the request body' });
  }

  try {
    const prompt = `You are an operations coordinator for a flight school. Based on the following context, craft three high-quality rescheduling suggestions. 
Return ONLY valid JSON array with objects containing keys: dateTime (string), reasoning (string), conditions { visibility, winds, sky, temperature (optional) }, tradeoffs (optional), benefits (optional).

Student context:
${JSON.stringify(student, null, 2)}

Weather summary:
${JSON.stringify(weather, null, 2)}

Scheduling conflict:
${JSON.stringify(conflict, null, 2)}

Ensure each suggestion is practical, aligned with student needs, and references weather considerations.`;

    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      temperature: 0.6,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find(
      (item) => (item as { type?: string }).type === 'text',
    ) as { type: string; text: string } | undefined;

    if (!textContent) {
      throw new Error('Claude response did not include text content');
    }

    const extractJson = (payload: string) => {
      const fencedMatch = payload.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fencedMatch && fencedMatch[1]) {
        return fencedMatch[1].trim();
      }
      return payload.trim();
    };

    let suggestions: unknown;

    try {
      suggestions = JSON.parse(extractJson(textContent.text));
    } catch (parseError) {
      throw new Error(
        `Claude response was not valid JSON. Received: ${textContent.text.slice(0, 200)}...`,
      );
    }

    return res.json({ suggestions });
  } catch (error) {
    const message = (error as Error).message;
    return res.status(500).json({ error: 'Unable to generate rescheduling options', details: message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

