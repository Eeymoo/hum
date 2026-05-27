#!/usr/bin/env node

import { Command } from 'commander'
import auth from '../src/commands/auth.js'
import config from '../src/commands/config.js'
import record from '../src/commands/record.js'
import timeline from '../src/commands/timeline.js'
import weight from '../src/commands/weight.js'
import exercise from '../src/commands/exercise.js'
import diet from '../src/commands/diet.js'
import sleep from '../src/commands/sleep.js'

const program = new Command()

program
  .name('hum')
  .description('Health tracking CLI')
  .version('0.1.0')

program.addCommand(auth)
program.addCommand(config)
program.addCommand(record)
program.addCommand(timeline)
program.addCommand(weight)
program.addCommand(exercise)
program.addCommand(diet)
program.addCommand(sleep)

program.parse()
