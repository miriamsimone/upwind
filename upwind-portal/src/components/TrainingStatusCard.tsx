import type { Student } from '../types';

interface TrainingStatusCardProps {
  student: Student;
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

const TrainingStatusCard = ({ student }: TrainingStatusCardProps) => {
  const totalHours = student.hoursLogged + student.hoursToNextMilestone;
  const progress =
    totalHours === 0
      ? 0
      : Math.round((student.hoursLogged / totalHours) * 100);

  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-sky-900">Training Status</h2>
        <span className="rounded-full bg-sky-50 px-4 py-1 text-sm font-medium text-sky-700">
          {student.trainingLevel.replace('-', ' ')}
        </span>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Hours Logged
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {student.hoursLogged} hrs
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Next Milestone
          </p>
          <p className="mt-2 text-lg font-medium text-slate-900">
            {student.nextMilestone}
          </p>
          <p className="text-sm text-slate-500">
            {student.hoursToNextMilestone} hrs remaining
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          Progress to Milestone
        </p>
        <div className="mt-3 h-3 rounded-full bg-slate-100">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-sky-500 to-sky-600"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {progress}% towards {student.nextMilestone}
        </p>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Focus Areas
          </p>
          <ul className="mt-2 space-y-2 text-sm text-slate-600">
            {student.skillsNeeded.map((skill) => (
              <li
                key={skill}
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-700"
              >
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                {skill}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Training Rhythm
          </p>
          <div className="mt-2 space-y-3 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-900">Frequency:</span>{' '}
              {student.trainingFrequency}
            </p>
            <div>
              <span className="font-medium text-slate-900">Availability:</span>
              <ul className="mt-2 space-y-1">
                {student.typicalAvailability.map((slot) => (
                  <li key={slot} className="capitalize text-slate-600">
                    {slot.replace('-', ' ')}
                  </li>
                ))}
              </ul>
            </div>
            <p>
              <span className="font-medium text-slate-900">
                Preferred time:
              </span>{' '}
              {student.preferredTimeOfDay}
            </p>
            <p>
              <span className="font-medium text-slate-900">Last lesson:</span>{' '}
              {formatDate(student.lastLessonDate)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingStatusCard;

