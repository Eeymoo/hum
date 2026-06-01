import { createCrudCommand } from '../lib/crud-command.js'

const diet = createCrudCommand('diet', {
  endpoint: '/diets',
  fields: [
    { flag: 'meal', description: 'Meal type (breakfast/lunch/dinner/snack)', formKey: 'mealType', required: true },
    { flag: 'calories', description: 'Calories' },
    { flag: 'protein', description: 'Protein (g)' },
    { flag: 'carbs', description: 'Carbs (g)' },
    { flag: 'fat', description: 'Fat (g)' },
    { flag: 'fiber', description: 'Fiber (g)' },
    { flag: 'sodium', description: 'Sodium (mg)' },
    { flag: 'foods', description: 'Foods in format: "name:amount,name2:amount2"' },
    { flag: 'water', description: 'Water (ml)' },
    { flag: 'extra-data', description: 'Extra data (JSON string)', formKey: 'extraData' },
    { flag: 'note', description: 'Note' }
  ],
  fileFields: ['file']
})

export default diet
