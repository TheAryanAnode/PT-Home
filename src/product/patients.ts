export type PatientRecord = {
  id: string
  code: string
  name: string
  adherence: number
  sessions: number
  baseline: number
  current: number
  formFrom: number
  formTo: number
  last: string
  completeness: number
  attention: string | null
  assignedExerciseIds: string[]
}

export const SEED_PATIENTS: PatientRecord[] = [
  {
    id: '0142',
    code: 'R-0142',
    name: 'Jordan Hale',
    adherence: 92,
    sessions: 18,
    baseline: 61,
    current: 88,
    formFrom: 72,
    formTo: 91,
    last: 'Today, 9:42 AM',
    completeness: 97,
    attention: 'Shoulder movement during elbow flexion increased from 9° to 17°.',
    assignedExerciseIds: ['elbow-flexion', 'hand-to-mouth', 'shoulder-flexion'],
  },
  {
    id: '0108',
    code: 'R-0108',
    name: 'Sam Okonkwo',
    adherence: 84,
    sessions: 14,
    baseline: 48,
    current: 71,
    formFrom: 64,
    formTo: 79,
    last: 'Yesterday, 4:10 PM',
    completeness: 91,
    attention: null,
    assignedExerciseIds: ['shoulder-abduction', 'scaption-raise', 'table-slide'],
  },
  {
    id: '0216',
    code: 'R-0216',
    name: 'Riley Cho',
    adherence: 76,
    sessions: 11,
    baseline: 55,
    current: 63,
    formFrom: 70,
    formTo: 74,
    last: 'Oct 7, 11:05 AM',
    completeness: 88,
    attention: 'Two sessions this week have incomplete hand-sensor data.',
    assignedExerciseIds: ['wrist-flexion', 'wrist-extension', 'assisted-curl'],
  },
  extra('0301', 'R-0301', 'Avery Singh', 72, 58),
  extra('0304', 'R-0304', 'Morgan Ellis', 66, 50),
  extra('0311', 'R-0311', 'Casey Nguyen', 74, 63),
  extra('0318', 'R-0318', 'Quinn Patel', 59, 44),
  extra('0322', 'R-0322', 'Harper Diaz', 70, 52),
  extra('0329', 'R-0329', 'Rowan Kim', 69, 57),
  extra('0335', 'R-0335', 'Jamie Brooks', 61, 49),
  extra('0341', 'R-0341', 'Cameron West', 73, 60),
  extra('0348', 'R-0348', 'Sage Alvarez', 64, 46),
]

function extra(
  id: string,
  code: string,
  name: string,
  current: number,
  baseline: number,
): PatientRecord {
  return {
    id,
    code,
    name,
    adherence: 78,
    sessions: 6,
    baseline,
    current,
    formFrom: 68,
    formTo: 80,
    last: 'Oct 3',
    completeness: 94,
    attention: null,
    assignedExerciseIds: ['elbow-flexion'],
  }
}
