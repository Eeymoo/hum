# Specialized Commands

Hum CLI provides dedicated commands for specific health tracking categories.

## Weight Tracking

```bash
# Log weight
hum weight log --value 70.5

# View weight timeline
hum weight timeline --last 30d

# Using generic record command
hum record add --type weight --data '{"value": 70.5, "unit": "kg"}'
```

## Exercise Tracking

```bash
# Log exercise
hum exercise log --type cardio --duration 30

# View exercise summary
hum exercise summary --last 7d

# Using generic record command
hum record add --type exercise --data '{"type": "running", "duration": 30, "calories": 300}'
```

## Diet Tracking

```bash
# Log meal
hum diet log --meal lunch --calories 500

# View diet summary
hum diet summary --date 2024-01-01

# Using generic record command
hum record add --type diet --data '{"meal": "lunch", "foods": [{"name": "salad", "calories": 200}]}'
```

## Sleep Tracking

```bash
# Log sleep
hum sleep log --hours 8 --quality good

# View sleep analysis
hum sleep analysis --last 7d

# Using generic record command
hum record add --type sleep --data '{"hours": 8, "quality": "good", "bedtime": "23:00"}'
```
