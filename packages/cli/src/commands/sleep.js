import { createCrudCommand } from '../lib/crud-command.js'

const sleep = createCrudCommand('sleep', {
  endpoint: '/sleeps',
  fields: [
    { flag: 'duration', description: 'Sleep duration in hours' },
    { flag: 'bedtime', description: 'Bedtime (HH:mm)', formKey: 'bedTime', required: true },
    { flag: 'waketime', description: 'Wake time (HH:mm)', formKey: 'wakeTime', required: true },
    { flag: 'quality', description: 'Sleep quality 1-10', required: true },
    { flag: 'deep-sleep', description: 'Deep sleep duration in hours', formKey: 'deepSleep' },
    { flag: 'rem-sleep', description: 'REM sleep duration in hours', formKey: 'remSleep' },
    { flag: 'awakenings', description: 'Number of awakenings' },
    { flag: 'feeling', description: 'Feeling 1-10' },
    { flag: 'extra-data', description: 'Extra data (JSON string)', formKey: 'extraData' },
    { flag: 'note', description: 'Note' }
  ],
  fileFields: ['file'],
  beforeAdd(opts) {
    let duration = opts.duration
    if (!duration && opts.bedtime && opts.waketime) {
      const [bh, bm] = opts.bedtime.split(':').map(Number)
      const [wh, wm] = opts.waketime.split(':').map(Number)
      let diff = (wh * 60 + wm) - (bh * 60 + bm)
      if (diff < 0) diff += 24 * 60
      duration = (diff / 60).toFixed(1)
    }
    if (!duration) {
      console.error('需要 --duration 或同时提供 --bedtime 和 --waketime')
      process.exit(1)
    }
    return {
      duration,
      bedTime: opts.bedtime,
      wakeTime: opts.waketime,
      quality: opts.quality,
      deepSleep: opts.deepSleep,
      remSleep: opts.remSleep,
      awakenings: opts.awakenings,
      feeling: opts.feeling,
      extraData: opts.extraData,
      note: opts.note,
      date: opts.date
    }
  }
})

export default sleep
