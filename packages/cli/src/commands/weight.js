import { createCrudCommand } from '../lib/crud-command.js'

const weight = createCrudCommand('weight', {
  endpoint: '/weights',
  fields: [
    { flag: 'value', description: 'Weight value (kg)', formKey: 'weight', required: true },
    { flag: 'body-fat', description: 'Body fat percentage', formKey: 'bodyFat' },
    { flag: 'muscle-mass', description: 'Muscle mass (kg)', formKey: 'muscleMass' },
    { flag: 'bmi', description: 'BMI' },
    { flag: 'water', description: 'Water percentage' },
    { flag: 'bone-mass', description: 'Bone mass (kg)', formKey: 'boneMass' },
    { flag: 'visceral-fat', description: 'Visceral fat level', formKey: 'visceralFat' },
    { flag: 'extra-data', description: 'Extra data (JSON string)', formKey: 'extraData' },
    { flag: 'note', description: 'Note for the record' }
  ],
  fileFields: ['file']
})

export default weight
