export interface Student {
  id: string;
  name: string;
  email: string;
  trainingLevel: 'student-pilot' | 'private-pilot' | 'instrument-rated';
  hoursLogged: number;
  hoursToNextMilestone: number;
  nextMilestone: string;
  skillsNeeded: string[];
  recentCancellations: number;
  typicalAvailability: string[];
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening';
  trainingFrequency: string;
  lastLessonDate: Date;
}

export interface FlightBooking {
  id: string;
  studentId: string;
  scheduledDate: Date;
  aircraft: string;
  instructor: string;
  departureLocation: {
    lat: number;
    lon: number;
    name: string;
  };
  status: 'scheduled' | 'weather-conflict' | 'rescheduled';
}

export interface WeatherData {
  temperature: number;
  winds: string;
  visibility: string;
  sky: string;
  conditions: 'VFR' | 'MVFR' | 'IFR';
  timestamp: Date;
}

export interface RescheduleOption {
  dateTime: string;
  reasoning: string;
  conditions: {
    visibility: string;
    winds: string;
    sky: string;
    temperature?: string;
  };
  tradeoffs?: string;
  benefits?: string;
}

