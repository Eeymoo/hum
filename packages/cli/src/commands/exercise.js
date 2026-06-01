import { createCrudCommand } from '../lib/crud-command.js'

const exercise = createCrudCommand('exercise', {
  endpoint: '/exercises',
  fields: [
    { flag: 'type', description: 'Exercise type (running/strength/cycling/swimming/other)', required: true },
    { flag: 'duration', description: 'Duration in minutes', required: true },
    { flag: 'calories', description: 'Calories burned', formKey: 'caloriesBurned' },
    { flag: 'activities', description: 'Activities in format: "name:prop1=val1,prop2=val2;name2:prop1=val1"' },
    { flag: 'heart-rate-avg', description: 'Average heart rate', formKey: 'heartRateAvg' },
    { flag: 'heart-rate-max', description: 'Max heart rate', formKey: 'heartRateMax' },
    { flag: 'feeling', description: 'Feeling 1-10' },
    { flag: 'extra-data', description: 'Extra data (JSON string)', formKey: 'extraData' },
    { flag: 'location', description: 'Location' },
    { flag: 'note', description: 'Note' }
  ],
  fileFields: ['file']
})

export default exercise
